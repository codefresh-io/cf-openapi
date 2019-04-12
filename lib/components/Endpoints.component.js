const _ = require('lodash');
const recursiveReadSync = require('klaw-sync');
const columnify = require('columnify');
const path = require('path');
const dereference = require('json-schema-deref-sync');

const Base = require('./base');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const { findAppRoot, reduceFiles } = require('../helpers/general');
const defaults = require('../../defaults');

const COMPONENT_REGEX = /((\w|-)+\.)+(\w|-)+/;

class Endpoints extends Base {
    constructor() {
        super();
        this.dependenciesSpecMiddleware = [];
        this.specMiddleware = [];
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

        const specPath = this.getSpecPath();
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

        const dependenciesSpecPath = this.getDependenciesSpecPath(); // eslint-disable-line
        const middlewares = this.dependenciesSpecMiddleware;

        app.get(dependenciesSpecPath, ...middlewares, (req, res) => {
            const specs = this.components.store.listServiceSpecs();
            const aggregated = this.components.processor.aggregateDependenciesSpec(specs);
            res.send(this.components.processor.postprocess(aggregated, {
                isRaw: _.has(req, 'query.raw'),
                disableFilter: true,
            }));
        });
    }

    registerRedocEndpoints(app) {
        if (this.spec === false && this.dependenciesSpec === false) {
            console.log('No redoc endpoints exposed: neither spec nor dependencies spec endpoints is enabled');
            return;
        }

        const specPath = this.getSpecPath();
        const dependenciesPath = this.getDependenciesSpecPath();

        const specRedocPath = this.getSpecRedocPath();
        const dependenciesSpecRedocPath = this.getDependenciesSpecRedocPath();

        handleRedocScript(app);

        if (this.spec !== false) {
            handleRedocIndex(app, specPath, specRedocPath, this.specMiddleware);
        }
        if (this.dependenciesSpec !== false) {
            handleRedocIndex(app, dependenciesPath, dependenciesSpecRedocPath, this.dependenciesSpecMiddleware);
        }
    }

    getSpecPath() {
        return _.get(this, 'spec.specPath', defaults.SPEC_PATH);
    }

    getDependenciesSpecPath() {
        return _.get(this, 'dependenciesSpec.specPath', defaults.ADMIN_SPEC_PATH);
    }

    getDependenciesSpecRedocPath() {
        return _.get(this, 'config.dependenciesSpec.redocPath', defaults.ADMIN_REDOC_PATH);
    }

    getSpecRedocPath() {
        return _.get(this, 'config.spec.redocPath', defaults.REDOC_PATH);
    }

    addSpecMiddleware(middleware) {
        this.specMiddleware.push(middleware);
    }

    addDependenciesSpecMiddleware(middleware) {
        this.dependenciesSpecMiddleware.push(middleware);
    }

    registerAppEndpoints(app) {
        let spec = this.components.spec.get();
        const basePath = this.components.spec.basePath();
        if (!spec) {
            console.error('Could not generate app endpoints: openapi spec is not provided');
            return;
        }

        if (!this.endpointsExist()) {
            console.error('Could not generate app endpoints: openapi spec has no endpoints');
            return;
        }

        spec = dereference(spec);

        _.forEach(spec.paths, (resource, urlPath) => {
            _.forEach(resource, (method, httpMethod) => {
                const endpointMeta = method['x-endpoint'];
                if (!endpointMeta) {
                    console.log(`No x-endpoint inside the spec for path: ${_.toUpper(httpMethod)} ${urlPath}`);
                    return;
                }

                const {
                    preMiddleware = [], postMiddleware = [], handler, condition, isEndpoint,
                } = endpointMeta;


                if (condition) {
                    const evaluateCondition = this._resolveComponent(this.condition, condition);
                    if (evaluateCondition && !evaluateCondition()) {
                        console.log(`Conditional endpoint is not registered for path "${urlPath}": condition "${condition}" is falsy`);
                        return;
                    }
                } else {
                    const globalConditions = this.components.spec.endpointConditions();
                    const highestCondition = _.chain(globalConditions)
                        .sortBy(c => -c.weight)
                        .filter(c => c.handlerRegex && new RegExp(c.handlerRegex).test(handler))
                        .first()
                        .value();
                    if (highestCondition) {
                        const evaluateCondition = this._resolveComponent(this.condition, highestCondition.condition);
                        if (!evaluateCondition()) {
                            console.log(`Conditional endpoint is not registered for path "${urlPath}": condition "${highestCondition.condition}" is falsy`); // eslint-disable-line max-len
                            return;
                        }
                    }
                }

                const routePath = this._prepareRoutePath(method, urlPath);
                const finalRoute = `${basePath}${routePath}`;
                const _handler = this._resolveComponent(this.controller, handler);
                const endpointHandler = isEndpoint === false ? _handler : this.makeEndpoint(_handler);
                const endpointPreMiddleware = _.map(preMiddleware, metaPath => this._resolveComponent(this.middleware, metaPath));
                const endpointPostMiddleware = _.map(postMiddleware, metaPath => this._resolveComponent(this.middleware, metaPath));

                this._register(app, httpMethod, finalRoute, endpointPreMiddleware, endpointHandler, endpointPostMiddleware);
                console.log(`Endpoint registered: ${_.toUpper(httpMethod)} ${finalRoute}`);
            });
        });
    }

    validateAppEndpoints() {
        const spec = this.components.spec.get();
        const specFilename = path.basename(this.components.spec.filename());
        if (!spec) {
            console.log('Could not validate app endpoints - openapi spec is not provided');
            return;
        }

        if (!this.endpointsExist()) {
            console.log('Could not validate app endpoints: openapi spec has no endpoints');
            return;
        }

        const errors = [];
        const globalConditions = this.components.spec.endpointConditions();
        _.forEach(globalConditions, (condition) => {
            this._validateComponent('condition', condition.condition, errors, 'global', 'global');
        });
        _.forEach(spec.paths, (resource, url) => {
            _.forEach(resource, (method, methodName) => {
                const endpoint = method['x-endpoint'];
                if (!endpoint) {
                    // todo: review
                    // errors.push({
                    //     component: specFilename,
                    //     message: 'x-endpoint property is missing',
                    //     spec_method: methodName,
                    //     spec_url: url,
                    // });
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
                    this._validateComponent('controller', endpoint.handler, errors, methodName, url);
                }

                _.forEach(_.union(endpoint.preMiddleware, endpoint.postMiddleware), (middleware) => {
                    this._validateComponent('middleware', middleware, errors, methodName, url);
                });

                if (endpoint.condition) {
                    this._validateComponent('condition', endpoint.condition, errors, methodName, url);
                }
            });
        });
        if (!_.isEmpty(errors)) {
            const message = columnify(_.sortBy(errors, ['component', 'message']), { columnSplitter: '  ' });
            throw new Error(`Openapi spec validation failed for endpoints:\n\n${message}\n\n`);
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

    loadEndpoints() {
        const files = _.map(recursiveReadSync(this.appRoot, { filter: f => f !== 'node_modules' }), f => f.path);
        this.controller = reduceFiles(files, '.controller.js');
        this.middleware = reduceFiles(files, '.middleware.js');
        this.condition = reduceFiles(files, '.condition.js');
    }

    endpointsExist() {
        const spec = this.components.spec.get();
        let atLeastOneEndpoint = false;
        _.forEach(_.get(spec, 'paths'), (resource) => {
            _.forEach(resource, (method) => {
                atLeastOneEndpoint = !!method['x-endpoint'];
                return !atLeastOneEndpoint;
            });
            return !atLeastOneEndpoint;
        });
        return atLeastOneEndpoint;
    }

    _validateComponent(componentName, componentPath, errors, httpMethod, url) {
        const component = this[componentName];
        if (!component) {
            throw new Error(`No such component: ${component}`);
        }

        if (!COMPONENT_REGEX.test(componentPath)) {
            errors.push({
                component: 'naming',
                message: `${componentPath} should match the regex: ${COMPONENT_REGEX}`,
                spec_method: httpMethod,
                spec_url: url,
            });
            return;
        }

        const [namespace, operation] = this._resolveComponentPath(componentPath);
        if (!component[namespace]) {
            errors.push({
                component: componentName,
                message: `no such ${componentName}: ${namespace}.${componentName}.js`,
                spec_method: httpMethod,
                spec_url: url,
            });
            return;
        }

        if (!component[namespace][operation]) {
            errors.push({
                component: `${namespace}.${componentName}.js`,
                message: `no such property: ${operation}`,
                spec_method: httpMethod,
                spec_url: url,
            });
        }
    }

    _resolveComponent(collector, componentPath) {
        const [namespace, method] = this._resolveComponentPath(componentPath);
        const component = collector[namespace];
        return component[method].bind(component);
    }

    _resolveComponentPath(metaPath) {
        const arr = metaPath.split('.');
        const namespace = _.slice(arr, 0, -1).join('.');
        const operation = _.last(arr);
        return [namespace, operation];
    }

    _prepareRoutePath(method, urlPath) {
        const params = urlPath.match(/{\w+}/g);
        const pathParams = this._reduceParams(method.parameters, 'path');
        return _.reduce(params, (_path, param) => {
            let _param = param.replace(/[{}]/g, '');
            if (_.get(pathParams, `${_param}.x-optional`)) { // todo: review
                _param = `${_param}?`;
            }
            return _path.replace(param, `:${_param}`);
        }, urlPath);
    }

    _reduceParams(params, type) {
        return _.chain(params)
            .filter(p => p.in === type)
            .reduce((acc, p) => _.merge(acc, { [p.name]: p }), {})
            .value();
    }

    _register(app, httpMethod, finalRoute, endpointPreMiddleware, endpointHandler, endpointPostMiddleware) {
        app[httpMethod].apply(app, [
            finalRoute,
            ...endpointPreMiddleware,
            endpointHandler,
            ...endpointPostMiddleware,
        ]);
    }
}

module.exports = new Endpoints();
