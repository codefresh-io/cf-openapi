const _ = require('lodash');
const path = require('path');
const flat = require('flat');

const Base = require('./base');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const defaults = require('../../defaults');
const { findAppRoot } = require('../helpers');

const APP_ENDPOINTS_PATH = './server/endpoints.js';

class Endpoints extends Base {
    constructor() {
        super();
        this.adminSpecMiddleware = [];
        this.specMiddleware = [];
        this.endpoints = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);
        this.components.spec.init(config);
        this.components.store.init(config);
        this.components.processor.init(config);

        const {
            root,
            openapi: {
                spec,
                adminSpec,
            } = {},
        } = config;
        this.appRoot = root || findAppRoot();
        this.spec = spec;
        this.adminSpec = adminSpec;

        this.loadAppEndpoints();
        this.validateAppEndpoints();

        return this;
    }

    loadAppEndpoints() {
        const endpointsPath = path.resolve(this.appRoot, APP_ENDPOINTS_PATH);
        if (!require.resolve(endpointsPath)) {
            console.error(`Could not load endpoints from path: ${endpointsPath}`);
            return;
        }
        this.endpoints = require(endpointsPath); // eslint-disable-line
    }

    register(app) {
        this.registerSpecEndpoint(app);
        this.registerAdminSpecEndpoint(app);
        this.registerRedocEndpoints(app);
        this.registerAppEndpoints(app);
    }

    registerSpecEndpoint(app) {
        if (this.spec === false) {
            console.log('Spec endpoint is disabled');
            return;
        }

        const spec = this.components.spec.get();
        if (!spec) {
            console.error('Spec endpoint is not registered: openapi.json does not exist');
            return;
        }

        const specPath = _.get(this, 'spec.specPath', defaults.SPEC_PATH);
        const middlewares = this.specMiddleware;

        app.get(specPath, ...middlewares, (req, res) => {
            res.send(this.components.processor.postprocess(this.components.spec.get(), {
                isRaw: _.has(req, 'query.raw'),
                disableFilter: _.has(req, 'query.disableFilter'),
            }));
        });
    }

    registerAdminSpecEndpoint(app) {
        if (this.adminSpec === false) {
            return;
        }

        const adminSpecPath = _.get(this, 'adminSpec.specPath', defaults.ADMIN_SPEC_PATH); // eslint-disable-line
        const middlewares = this.adminSpecMiddleware;

        app.get(adminSpecPath, ...middlewares, (req, res) => {
            res.send(this.components.processor.aggregateAdminSpec(this.components.store.listServiceSpecs()));
        });
    }

    registerRedocEndpoints(app) {
        if (this.spec === false || this.adminSpec === false) {
            console.error('Neither spec nor admin spec endpoints is enabled');
            return;
        }

        const specPath = _.get(this, 'config.spec.specPath', defaults.SPEC_PATH);
        const adminSpecPath = _.get(this, 'config.adminSpec.specPath', defaults.ADMIN_SPEC_PATH);

        const specRedocPath = _.get(this, 'config.spec.redocPath', defaults.REDOC_PATH);
        const adminRedocPath = _.get(this, 'config.adminSpec.redocPath', defaults.ADMIN_REDOC_PATH);

        handleRedocScript(app);

        if (this.spec !== false) {
            handleRedocIndex(app, specPath, specRedocPath);
        }
        if (this.adminSpec !== false) {
            handleRedocIndex(app, adminSpecPath, adminRedocPath);
        }
    }

    addSpecMiddleware(middleware) {
        this.specMiddleware.push(middleware);
    }

    addAdminSpecMiddleware(middleware) {
        this.adminSpecMiddleware.push(middleware);
    }

    registerAppEndpoints(app) {
        const spec = this.components.spec.get();
        if (!spec) {
            console.error('Could not generate app endpoints - openapi spec is not provided');
            return;
        }

        _.forEach(spec.paths, (resource, path) => { // eslint-disable-line
            const params = path.match(/{\w+}/g);
            const routePath = _.reduce(params, (_path, param) => {
                const _param = param.replace('{', ':').replace('}', '');
                return _path.replace(param, _param);
            }, path);
            _.forEach(resource, (method, httpMethod) => {
                const endpointPath = method['x-sdk-interface'];
                if (!endpointPath) {
                    console.error(`No x-endpoint for path: ${_.toUpper(httpMethod)} ${path}`);
                    return;
                }

                const endpoint = _.get(this.endpoints, endpointPath);
                if (!endpoint) {
                    console.error(`No endpoint for "${endpointPath}" inside the ${APP_ENDPOINTS_PATH}`);
                    return;
                }

                if (!endpoint.predicate()) {
                    console.error(`Conditional endpoint is not registered for "${endpointPath}": condition is falsy`);
                    return;
                }

                const finalRoute = `${endpoint.root}${routePath}`;
                app[httpMethod].apply(app, [
                    finalRoute,
                    ...endpoint.preMiddleware,
                    this.makeEndpoint(endpoint.handler),
                    ...endpoint.postMiddleware,
                ]);
                console.log(`Endpoint registered: ${_.toUpper(httpMethod)} ${finalRoute}`);
            });
        });
    }

    validateAppEndpoints() {
        const spec = this.components.spec.get();
        const endpoints = this.endpoints; // eslint-disable-line
        if (!spec) {
            console.error('Could not validate app endpoints - openapi spec is not provided');
            return;
        }
        if (!endpoints) {
            console.error(`Could not validate app endpoints: endpoints are not loaded from ${APP_ENDPOINTS_PATH}`);
            return;
        }

        const endpointsInterfaces = _.chain(flat(endpoints))
            .keys()
            .filter(k => _.endsWith(k, 'handler'))
            .map(k => k.replace('.handler', ''))
            .value();

        const specInterfaces = _.chain(spec.paths)
            .map(resource => _.values(resource))
            .flattenDeep()
            .map(method => method['x-sdk-interface'])
            .value();

        const difference = _.difference(endpointsInterfaces, specInterfaces);
        if (!_.isEmpty(difference)) {
            const message = `Openapi spec has no such endpoints, but they are described inside ${APP_ENDPOINTS_PATH}: ${difference.map(s => `\n\t - ${s}`)}`; // eslint-disable-line
            throw new Error(message);
        }
    }

    makeEndpoint(fn) {
        return function (req, res, next) { // eslint-disable-line
            Promise.resolve()
                .then(() => fn(req, res))
                .then((ret) => {
                    res.send(ret);
                })
                .catch(err => next(err));
        };
    }
}

module.exports = new Endpoints();
