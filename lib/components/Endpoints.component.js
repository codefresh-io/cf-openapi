const _ = require('lodash');
const recursiveReadSync = require('klaw-sync');
const columnify = require('columnify');
const path = require('path');
const dereference = require('json-schema-deref-sync');

const Base = require('./base');
const { DisableScopesError, MissingScopesError } = require('../errors');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const { findAppRoot, reduceFiles } = require('../helpers/general');
const defaults = require('../../defaults');

const COMPONENT_REGEX = /((\w|-)+\.)+(\w|-)+/;

const ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
};

const SCOPE_ACTIONS = {
    admin: 'admin',
    write: 'write',
    read: 'read',
};


class Endpoints extends Base {
    constructor() {
        super();
        this.dependenciesSpecMiddleware = [];
        this.specMiddleware = [];
        this.scopeMiddleware = [];
        this.controller = {};
        this.middleware = {};
        this.condition = {};
        this.abac = {};
        this.scopeExtractor = null;
        this.missingScopeHandler = missingScopes => new MissingScopesError(`Scopes are missing to access this resource: ${missingScopes}`);
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

    componentRegex() {
        return COMPONENT_REGEX;
    }

    register(app) {
        this.registerSpecEndpoint(app);
        this.registerScopeEndpoint(app);
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
            console.log('Spec endpoint is not registered: openapi.json is not loaded from filesystem');
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

    registerScopeEndpoint(app) {
        const spec = this.components.spec.get();
        if (!spec) {
            console.log('Scope endpoint is not registered: openapi.json is not loaded from filesystem');
            return;
        }

        if (!this.scopeExtractor) {
            console.log('Scope endpoint is not registered: scope extractor is not set');
            return;
        }

        const scopesPath = this.getScopesPath();
        const middlewares = this.scopeMiddleware;

        const scopeObject = this.components.spec.collectScopeObject();
        app.get(scopesPath, ...middlewares, (req, res) => res.send(scopeObject));
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

    getScopesPath() {
        return _.get(this, 'spec.scopesPath', defaults.SCOPES_PATH);
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

    addScopeEndpointMiddleware(middleware) {
        this.scopeMiddleware.push(middleware);
    }

    /**
     * @param extractorFn - function that receives request and endpoint scopes
     * and returns user scope array or throws DisableScopesError if validation must be skipped
     * */
    setScopeExtractor(extractorFn) {
        this.scopeExtractor = extractorFn;
    }

    /**
     * @param handlerFn - function that receives missing scope and returns either null or error
     * */
    setMissingScopeHandler(handlerFn) {
        this.missingScopeHandler = handlerFn;
    }

    registerAppEndpoints(app) {
        let spec = this.components.spec.get();
        const basePath = this.components.spec.basePath();
        if (!spec) {
            console.log('Could not generate app endpoints: openapi spec is not loaded from filesystem');
            return;
        }

        if (!this.endpointsExist()) {
            console.log('Could not generate app endpoints: openapi spec has no endpoints');
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

                _.assign(endpointMeta, {
                    urlPath,
                    httpMethod,
                });


                const shouldBeExposed = this._checkEndpointCondition(endpointMeta);
                if (!shouldBeExposed) {
                    return;
                }

                const routePath = this._prepareRoutePath(method, urlPath);
                const finalRoute = `${basePath}${routePath}`;
                const endpointHandler = this._prepareHandler(endpointMeta);
                const endpointPreMiddleware = this._preparePreMiddleware(endpointMeta);
                const endpointPostMiddleware = this._preparePostMiddleware(endpointMeta);

                this._register(app, httpMethod, finalRoute, endpointPreMiddleware, endpointHandler, endpointPostMiddleware);
            });
        });
    }

    _prepareHandler(endpointMeta) {
        const {
            handler: handlerMetaPath,
            isEndpoint,
        } = endpointMeta;
        const handler = this._resolveComponent(this.controller, handlerMetaPath);
        return isEndpoint === false ? handler : this.makeEndpoint(handler);
    }

    _checkEndpointCondition(endpointMeta) {
        const {
            handler,
            condition,
            urlPath,
        } = endpointMeta;

        if (condition) {
            const evaluateCondition = this._resolveComponent(this.condition, condition);
            if (evaluateCondition && !evaluateCondition()) {
                console.log(`Conditional endpoint is not registered for path "${urlPath}": condition "${condition}" is falsy`);
                return false;
            }
        }

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
                return false;
            }
        }
        return true;
    }

    _preparePreMiddleware(endpointMeta) {
        const {
            auth: {
                middleware: authMiddlewareMetaPaths = [],
                acl: aclOptions,
            } = {},
            preMiddleware: logicMiddlewareMetaPaths = [],
            urlPath,
            httpMethod,
        } = endpointMeta;
        const preparedAclOptions = this._prepareAccessControlOptions(aclOptions, urlPath, httpMethod);
        const authPreMiddleware = _.map(authMiddlewareMetaPaths, metaPath => this._resolveComponent(this.middleware, metaPath));
        const scopePreMiddleware = this._createScopeMiddleware(preparedAclOptions);
        const abacPreMiddleware = this._createAbacMiddleware(preparedAclOptions);

        const { resource, action } = preparedAclOptions;
        if (!_.isEmpty(abacPreMiddleware)) {
            console.log(`Abac ${resource}:${action} : ${_.toUpper(httpMethod)} ${urlPath}`);
        }

        const logicPreMiddleware = _.map(logicMiddlewareMetaPaths, metaPath => this._resolveComponent(this.middleware, metaPath));

        return _.concat(authPreMiddleware, scopePreMiddleware, abacPreMiddleware, logicPreMiddleware);
    }

    _preparePostMiddleware(endpointMeta) {
        const {
            postMiddleware: postMiddlewareMetaPaths = [],
        } = endpointMeta;
        return _.map(postMiddlewareMetaPaths, metaPath => this._resolveComponent(this.middleware, metaPath));
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

                const middlewareToValidate = _.union(endpoint.preMiddleware, endpoint.postMiddleware, _.get(endpoint, 'auth.middleware'));
                _.forEach(middlewareToValidate, (middleware) => {
                    this._validateComponent('middleware', middleware, errors, methodName, url);
                });

                if (endpoint.condition) {
                    this._validateComponent('condition', endpoint.condition, errors, methodName, url);
                }

                const aclOptions = _.get(endpoint, 'auth.acl', {});
                const {
                    abac: enableAbac,
                    resource: aclResource,
                    abacSource,
                } = this._prepareAccessControlOptions(aclOptions, url, methodName);
                if (enableAbac && !this.abac[abacSource || aclResource]) {
                    errors.push({
                        component: 'endpoint.auth.acl',
                        message: `${abacSource || aclResource}.abac.js does not exist`,
                        spec_method: methodName,
                        spec_url: url,
                    });
                }
            });
        });
        if (!_.isEmpty(errors)) {
            const message = columnify(_.sortBy(errors, ['component', 'message']), { columnSplitter: '  ' });
            throw new Error(`Openapi spec validation failed for endpoints:\n\n${message}\n\n`);
        }
    }

    makeEndpoint(fn) {
        if (!_.isFunction(fn)) {
            throw new Error(`Cannot make endpoint - should be a function: ${fn}`);
        }
        return function (req, res, next) { // eslint-disable-line
            Promise.resolve()
                .then(() => fn(req, res))
                .then((ret) => {
                    res.send(ret);
                    next();
                })
                .catch(err => next(err));
        };
    }

    loadEndpoints() {
        const files = _.map(recursiveReadSync(this.appRoot, {
            filter: (f) => { // eslint-disable-line
                return !f.path.includes('node_modules') && !path.basename(f.path).startsWith('.');
            },
        }), f => f.path);
        this.controller = reduceFiles(files, '.controller.js');
        this.middleware = reduceFiles(files, '.middleware.js');
        this.condition = reduceFiles(files, '.condition.js');
        this.abac = reduceFiles(files, '.abac.js');
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
        const componentMethod = component[method];
        return _.isFunction(componentMethod) ? componentMethod.bind(component) : componentMethod;
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
        app[httpMethod](..._.concat(
            finalRoute,
            endpointPreMiddleware,
            endpointHandler,
            endpointPostMiddleware,
        ));
        console.log(`Endpoint registered: ${_.toUpper(httpMethod)} ${finalRoute}`);
    }

    _createScopeMiddleware(accessControlOptions) {
        const self = this;
        const endpointScope = this._resolveEndpointScope(accessControlOptions);
        if (!this.scopeExtractor || accessControlOptions.disableScopes) {
            return [];
        }
        return [(request, response, next) => {
            let userScope;
            try {
                userScope = self.scopeExtractor(request, [endpointScope]);
            } catch (e) {
                if (e instanceof DisableScopesError) {
                    next(); // disable scopes
                    return;
                }
                next(e);
                return;
            }

            if (this._hasEnoughScope(userScope, endpointScope)) {
                next();
                return;
            }

            next(self.missingScopeHandler([endpointScope]));
        }];
    }

    _createAbacMiddleware(preparedAccessControlOptions) {
        const options = preparedAccessControlOptions;
        if (!options.abac) {
            return [];
        }

        const source = options.abacSource || options.resource;

        const abacFactory = this.abac[source];
        if (!abacFactory) {
            return [];
        }

        const abacMiddleware = abacFactory(options);
        return _.isArray(abacMiddleware) ? abacMiddleware : [abacMiddleware];
    }

    _resolveResourceNameFromUrl(urlPath) {
        return _.chain(urlPath)
            .replace('/', '')
            .split('/')
            .first()
            .value();
    }

    _resolveActionFromHttpMethod(httpMethod) {
        switch (httpMethod) {
            case 'post':
                return ACTIONS.CREATE;
            case 'get':
            case 'head':
            case 'options':
                return ACTIONS.READ;
            case 'put':
                return ACTIONS.UPDATE;
            case 'patch':
                return ACTIONS.UPDATE;
            case 'delete':
                return ACTIONS.DELETE;
            default:
                return httpMethod.toLowerCase();
        }
    }

    _prepareAccessControlOptions(options, urlPath, httpMethod) {
        let { resource, action } = options || {};
        if (!resource) {
            resource = this._resolveResourceNameFromUrl(urlPath);
        }

        if (!action) {
            action = this._resolveActionFromHttpMethod(httpMethod);
        }
        return _.merge(options, { resource, action });
    }

    _resolveScopeFromAction(action) {
        switch (action) {
            case ACTIONS.READ:
                return SCOPE_ACTIONS.read;
            case ACTIONS.CREATE:
            case ACTIONS.UPDATE:
            case ACTIONS.DELETE:
                return SCOPE_ACTIONS.write;
            default:
                return action;
        }
    }

    _resolveEndpointScope(preparedAccessControlOptions) {
        const { resource, action, admin, scope } = preparedAccessControlOptions; // eslint-disable-line
        const adminScope = admin && SCOPE_ACTIONS.admin;
        const calculatedScope = adminScope || scope || this._resolveScopeFromAction(action);
        return `${resource}:${calculatedScope}`;
    }

    _hasEnoughScope(userScopeArr, endpointScope) {
        let hasEnoughScope = false;
        _.forEach(userScopeArr, (userScope) => {
            hasEnoughScope = endpointScope.startsWith(userScope);
            return !hasEnoughScope;
        });
        return hasEnoughScope;
    }
}

module.exports = new Endpoints();
