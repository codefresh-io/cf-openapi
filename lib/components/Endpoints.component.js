const _ = require('lodash');
const recursiveReadSync = require('klaw-sync');
const columnify = require('columnify');
const path = require('path');

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
        this.condition = {};
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
            handleRedocIndex(app, specPath, specRedocPath, this.specMiddleware);
        }
        if (this.dependenciesSpec !== false) {
            handleRedocIndex(app, dependenciesPath, dependenciesSpecRedocPath, this.dependenciesSpecMiddleware);
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

                const endpointCondition = _.get(this.condition, condition, () => true);
                if (!endpointCondition()) {
                    console.error(`Conditional endpoint is not registered for "${path}": condition is falsy`);
                    return;
                }

                const finalRoute = `${basePath}${routePath}`;
                const _handler = this._resolveMeta(this.controller, handler);
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
        const spec = this.components.spec.get();
        const specFilename = path.basename(this.components.spec.filename());
        if (!spec) {
            console.error('Could not validate app endpoints - openapi spec is not provided');
            return;
        }

        let atLeastOneEndpoint = false;
        _.forEach(spec.paths, (resource) => {
            _.forEach(resource, (method) => {
                atLeastOneEndpoint = !!method['x-endpoint'];
                return !atLeastOneEndpoint;
            });
            return !atLeastOneEndpoint;
        });
        if (!atLeastOneEndpoint) {
            console.error('Could not validate app endpoints: openapi spec has no endpoints');
            return;
        }

        const errors = [];
        _.forEach(spec.paths, (resource, url) => {
            _.forEach(resource, (method, methodName) => {
                const endpoint = method['x-endpoint'];
                if (!endpoint) {
                    errors.push({
                        component: specFilename,
                        message: 'x-endpoint property is missing',
                        spec_method: methodName,
                        spec_url: url,
                    });
                    return;
                }
                if (!endpoint.handler) {
                    errors.push({
                        component: specFilename,
                        message: 'x-endpoint.handler property is missing',
                        spec_method: methodName,
                        spec_url: url,
                    });
                } else {
                    const [namespace, operation] = endpoint.handler.split('.');
                    this._validateComponent('controller', namespace, operation, errors, methodName, url);
                }

                _.forEach(_.union(endpoint.preMiddleware, endpoint.postMiddleware), (middleware) => {
                    const [namespace, operation] = middleware.split('.');
                    this._validateComponent('middleware', namespace, operation, errors, methodName, url);
                });

                if (endpoint.condition) {
                    const [namespace, operation] = endpoint.condition.split('.');
                    this._validateComponent('condition', namespace, operation, errors, methodName, url);
                }
            });
        });
        if (!_.isEmpty(errors)) {
            const message = columnify(_.sortBy(errors, ['component', 'message']), { columnSplitter: '  ' });
            throw new Error(`Openapi spec validation failed for endpoints:\n\n${message}\n\n`);
        }
    }

    _validateComponent(component, namespace, operation, errors, httpMethod, url) {
        if (!_.has(this, `${component}.${namespace}`)) {
            errors.push({
                component: `${component}`,
                message: `no such ${component}: ${namespace}.${component}.js`,
                spec_method: httpMethod,
                spec_url: url,
            });
        } else if (!_.get(this, `${component}.${namespace}.${operation}`)) {
            errors.push({
                component: `${namespace}.${component}.js`,
                message: ` no such method: ${operation}()`,
                spec_method: httpMethod,
                spec_url: url,
            });
        }
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
        this.condition = reduceFiles(files, '.condition.js');
    }

    _resolveMeta(collector, metaPath) {
        const [namespace, method] = metaPath.split('.');
        const component = collector[namespace];
        return component[method].bind(component);
    }
}

module.exports = new Endpoints();
