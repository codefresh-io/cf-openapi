const _ = require('lodash');
const recursiveReadSync = require('klaw-sync');

const Base = require('./base');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const defaults = require('../../defaults');
const buildEndpoints = require('../helpers/endpoints');
const { findAppRoot, reduceFiles } = require('../helpers/general');


class Endpoints extends Base {
    constructor() {
        super();
        this.dependenciesSpecMiddleware = [];
        this.specMiddleware = [];
        this.endpoints = {};
        this.controller = {};
        this.middleware = {};
        this.conditions = {};
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
                dependenciesSpec,
            } = {},
        } = config;
        this.spec = spec;
        this.appRoot = root || findAppRoot();
        this.dependenciesSpec = dependenciesSpec;
        this.loadEndpoints();
        this.validateAppEndpoints();
        return this;
    }

    register(app) {
        this.registerSpecEndpoint(app);
        this.registerDependenciesSpecEndpoint(app);
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

    registerDependenciesSpecEndpoint(app) {
        if (this.dependenciesSpec === false) {
            console.log('Dependencies spec endpoint is disabled');
            return;
        }

        const dependenciesSpecPath = _.get(this, 'dependenciesSpec.specPath', defaults.ADMIN_SPEC_PATH); // eslint-disable-line
        const middlewares = this.dependenciesSpecMiddleware;

        app.get(dependenciesSpecPath, ...middlewares, (req, res) => {
            res.send(this.components.processor.aggregateDependenciesSpec(this.components.store.listServiceSpecs()));
        });
    }

    registerRedocEndpoints(app) {
        if (this.spec === false && this.dependenciesSpec === false) {
            console.log('No redoc endpoints exposed: neither spec nor dependencies spec endpoints is enabled');
            return;
        }

        const specPath = _.get(this, 'config.spec.specPath', defaults.SPEC_PATH);
        const dependenciesPath = _.get(this, 'config.dependenciesSpec.specPath', defaults.ADMIN_SPEC_PATH);

        const specRedocPath = _.get(this, 'config.spec.redocPath', defaults.REDOC_PATH);
        const dependenciesSpecRedocPath = _.get(this, 'config.dependenciesSpec.redocPath', defaults.ADMIN_REDOC_PATH);

        handleRedocScript(app);

        if (this.spec !== false) {
            handleRedocIndex(app, specPath, specRedocPath);
        }
        if (this.dependenciesSpec !== false) {
            handleRedocIndex(app, dependenciesPath, dependenciesSpecRedocPath);
        }
    }

    addSpecMiddleware(middleware) {
        this.specMiddleware.push(middleware);
    }

    addDependenciesSpecMiddleware(middleware) {
        this.dependenciesSpecMiddleware.push(middleware);
    }

    registerAppEndpoints(app) {
        const spec = this.components.spec.get();
        const basePath = this.components.spec.basePath();
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
                const endpointMeta = method['x-endpoint'];
                if (!endpointMeta) {
                    console.error(`No x-endpoint inside the spec for path: ${_.toUpper(httpMethod)} ${path}`);
                    return;
                }

                const {
                    preMiddleware = [], postMiddleware = [], handler, condition, isNotEndpoint,
                } = endpointMeta;

                const endpointCondition = _.get(this.conditions, condition, () => true);
                if (!endpointCondition()) {
                    console.error(`Conditional endpoint is not registered for "${path}": condition is falsy`);
                    return;
                }

                const finalRoute = `${basePath}${routePath}`;
                const _handler = this._resolveMeta(this.controllers, handler);
                const endpointHandler = isNotEndpoint ? _handler : this.makeEndpoint(_handler);
                const endpointPreMiddleware = _.map(preMiddleware, metaPath => this._resolveMeta(this.middleware, metaPath));
                const endpointPostMiddleware = _.map(postMiddleware, metaPath => this._resolveMeta(this.middleware, metaPath));

                app[httpMethod].apply(app, [
                    finalRoute,
                    ...endpointPreMiddleware,
                    endpointHandler,
                    ...endpointPostMiddleware,
                ]);
                console.log(`Endpoint registered: ${_.toUpper(httpMethod)} ${finalRoute}`);
            });
        });
    }

    validateAppEndpoints() {
        console.error('validate');
        // const endpoints = this.endpoints; // eslint-disable-line
        // if (!_.isEmpty(endpoints)) {
        //     console.error('Could not validate app endpoints: endpoints are not loaded');
        //     return;
        // }
        //
        // const endpointsInterfaces = _.chain(flat(endpoints))
        //     .keys()
        //     .filter(k => _.endsWith(k, 'handler'))
        //     .map(k => k.replace('.handler', ''))
        //     .value();
        //
        // const specInterfaces = _.chain(spec.paths)
        //     .map(resource => _.values(resource))
        //     .flattenDeep()
        //     .map(method => method['x-sdk-interface'])
        //     .value();
        //
        // const difference = _.difference(endpointsInterfaces, specInterfaces);
        // if (!_.isEmpty(difference)) {
        //     const message = `Openapi spec has no such endpoints, but they are described inside ${APP_ENDPOINTS_PATH}: ${difference.map(s => `\n\t - ${s}`)}`; // eslint-disable-line
        //     throw new Error(message);
        // }
    }

    build() {
        return buildEndpoints(this.endpoints);
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

    loadEndpoints() {
        const files = recursiveReadSync(this.appRoot, { filter: f => f !== 'node_modules' }).map(f => f.path);
        this.controller = reduceFiles(files, '.controller.js');
        this.middleware = reduceFiles(files, '.middleware.js');
        this.conditions = reduceFiles(files, '.conditions.js');
    }

    _resolveMeta(collector, metaPath) {
        const [namespace, method] = metaPath.split('.');
        const component = collector[namespace];
        return component[method].bind(component);
    }
}

module.exports = new Endpoints();
