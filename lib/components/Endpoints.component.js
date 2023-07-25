const _ = require('lodash');
const recursiveReadSync = require('klaw-sync');
const columnify = require('columnify');
const path = require('path');
const CFError = require('cf-errors');

const Base = require('./base');
const EndpointValidator = require('../validation/EndpointValidator');
const { MissingScopesError } = require('../errors');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const helpers = require('../helpers/general');
const defaults = require('../../defaults');
const { GENERAL_SCOPES } = require('../helpers/general');

class Endpoints extends Base {
    constructor() {
        super();
        this.dependenciesSpecMiddleware = [];
        this.specMiddleware = [];
        this.scopeEndpointMiddleware = [];
        this.abacEndpointMiddleware = [];
        this.appComponents = {
            controller: {},
            middleware: {},
            condition: {},
            abac: {},
        };
        this.scopeExtractor = null;
        this.scopeCondition = null;
        this.identityExtractor = null;
        this.cacheCondition = () => false;
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
        this.appRoot = root || helpers.findAppRoot();
        this.dependenciesSpec = dependenciesSpec;
        this.loadAppComponents();
        this.validateAppEndpoints();
        return this;
    }

    register(app) {
        this.registerSpecEndpoint(app);
        this.registerScopeEndpoint(app);
        this.registerAbacEndpoint(app);
        this.registerDependenciesSpecEndpoint(app);
        this.registerRedocEndpoints(app);
        this.registerAppEndpoints(app);
    }

    registerUtilityMiddleware(app) {
        const endpoints = this.components.spec.getEndpoints();
        // iterate over array not object - maintain order.
        _.forEach(Object.keys(endpoints), (key) => {
            const endpoint = endpoints[key];
            endpoint.registerUtilityMiddleware(app);
        });
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

        const specPath = this.getSpecEndpointPath();
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

        const scopesPath = this.getScopesEndpointPath();
        const middlewares = this.scopeEndpointMiddleware;

        const scopeObject = this.components.spec.collectScopeObject();
        app.get(scopesPath, ...middlewares, (req, res) => res.send(scopeObject));
    }

    registerAbacEndpoint(app) {
        const spec = this.components.spec.get();
        if (!spec) {
            console.log('Abac endpoint is not registered: openapi.json is not loaded from filesystem');
            return;
        }

        const abacPath = this.getAbacEndpointPath();
        const middlewares = this.abacEndpointMiddleware;

        const abacResources = this.components.spec.collectAbacResources();
        if (_.isEmpty(abacResources)) {
            console.log('Abac endpoint is not registered: service has no abac resources');
            return;
        }

        app.get(abacPath, ...middlewares, (req, res) => res.send(abacResources));
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

        const specPath = this.getSpecEndpointPath();
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

    getSpecEndpointPath() {
        return _.get(this, 'spec.specPath', defaults.SPEC_ENDPOINT_PATH);
    }

    getScopesEndpointPath() {
        return _.get(this, 'config.openapi.scopesPath', defaults.SCOPES_ENDPOINT_PATH);
    }

    getAbacEndpointPath() {
        return _.get(this, 'config.openapi.abacPath', defaults.ABAC_ENDPOINT_PATH);
    }

    getDependenciesSpecPath() {
        return _.get(this, 'dependenciesSpec.specPath', defaults.ADMIN_SPEC_ENDPOINT_PATH);
    }

    getDependenciesSpecRedocPath() {
        return _.get(this, 'config.dependenciesSpec.redocPath', defaults.ADMIN_REDOC_ENDPOINT_PATH);
    }

    getSpecRedocPath() {
        return _.get(this, 'config.spec.redocPath', defaults.REDOC_ENDPOINT_PATH);
    }

    addSpecMiddleware(middleware) {
        this.specMiddleware.push(middleware);
    }

    addDependenciesSpecMiddleware(middleware) {
        this.dependenciesSpecMiddleware.push(middleware);
    }

    addScopeEndpointMiddleware(middleware) {
        this.scopeEndpointMiddleware.push(middleware);
    }

    addAbacEndpointMiddleware(middleware) {
        this.abacEndpointMiddleware.push(middleware);
    }

    /**
     * @param extractorFn - function that receives request
     * and returns user scope array
     * */
    setScopeExtractor(extractorFn) {
        this.scopeExtractor = extractorFn;
    }

    /**
     * @param scopeConditionFn - function that receives request and endpoint scopes
     * and returns Boolean to define whether apply scopes or not
     * */
    setScopeCondition(scopeConditionFn) {
        this.scopeCondition = scopeConditionFn;
    }

    /**
     * @param handlerFn - function that receives missing scope and returns either null or error
     * */
    setMissingScopeHandler(handlerFn) {
        this.missingScopeHandler = handlerFn;
    }
    /**
     * @param cacheConditionFn - function that receives request and cache metadata
     * */
    setCacheCondition(cacheConditionFn) {
        this.cacheCondition = cacheConditionFn;
    }

    /**
     * @param handlerFn - function that receives request returns current authentication id
     * */
    setIdentityExtractor(handlerFn) {
        this.identityExtractor = handlerFn;
    }

    registerAppEndpoints(app) {
        const spec = this.components.spec.get();
        if (!spec) {
            console.log('Could not generate app endpoints: openapi spec is not loaded from filesystem');
            return;
        }

        const endpoints = this.components.spec.getEndpoints();
        if (_.isEmpty(endpoints)) {
            console.log('Could not generate app endpoints: openapi spec has no endpoints');
            return;
        }

        // iterate over array not object - maintain order.
        _.forEach(Object.keys(endpoints), (key) => {
            const endpoint = endpoints[key];
            endpoint.prepare();
            endpoint.register(app);
        });
    }

    validateAppEndpoints() {
        const spec = this.components.spec.get();
        if (!spec) {
            console.log('Could not validate app endpoints - openapi spec is not provided');
            return;
        }

        const endpoints = this.components.spec.getEndpoints();
        if (_.isEmpty(endpoints)) {
            console.log('Could not validate app endpoints: openapi spec has no endpoints');
            return;
        }

        const errors = [];
        const globalConditions = this.components.spec.endpointConditions();
        _.forEach(globalConditions, (condition) => {
            errors.push(...EndpointValidator.validateAppComponent(
                'condition',
                condition.condition,
                this.appComponents,
                'global',
                'global',
            ));
        });

        const validator = new EndpointValidator(this.appComponents);
        _.forEach(Object.keys(endpoints), (key) => {
            const endpoint = endpoints[key];
            errors.push(...validator.validate(endpoint, { isScopeExtractorEnabled: !!this.scopeExtractor }));
        });

        if (!_.isEmpty(errors)) {
            const message = columnify(_.sortBy(errors, ['component', 'message']), { columnSplitter: '  ' });
            throw new Error(`Openapi spec validation failed for endpoints:\n\n${message}\n\n`);
        }
    }

    loadAppComponents() {
        const files = _.map(recursiveReadSync(this.appRoot, {
            filter: (f) => { // eslint-disable-line
                return !f.path.includes('node_modules') && !path.basename(f.path).startsWith('.');
            },
        }), f => f.path);
        this.appComponents.controller = helpers.reduceFiles(files, '.controller.js');
        this.appComponents.middleware = helpers.reduceFiles(files, '.middleware.js');
        this.appComponents.condition = helpers.reduceFiles(files, '.condition.js');
        this.appComponents.abac = helpers.reduceFiles(files, '.abac.js');

        const endpoints = this.components.spec.getEndpoints();
        _.forEach(endpoints, (endpoint) => {
            endpoint.setParent(this);
        });
    }

    createGeneralScopeMiddleware(endpoint = {}) {
        endpoint = _.cloneDeep(endpoint);

        if (!this.scopeExtractor) {
            throw new CFError('Scope extractor is not defined -- please do openapi.endpoints().setScopeExtractor((req) => extract(req))');
        }

        const finalEndpoint = _.defaultsDeep(endpoint, {
            scope: 'general',
            spec: {
                acl: {
                    disableScopes: false,
                },
            },
        });
        const endpointGeneralScopes = _.values(GENERAL_SCOPES);
        if (!endpointGeneralScopes.includes(endpoint.scope)) {
            throw new CFError(`General endpoint scope must be one of: ${endpointGeneralScopes}`);
        }

        return _.first(this._createScopeMiddleware(finalEndpoint));
    }

    createScopeMiddleware(endpoint) {
        endpoint = _.cloneDeep(endpoint);

        if (!this.scopeExtractor) {
            throw new CFError('Scope extractor is not defined -- please do openapi.endpoints().setScopeExtractor((req) => extract(req))');
        }

        if (!endpoint || !endpoint.scope) {
            throw new CFError('Endpoint scope must be provided');
        }

        const existingScopes = this.components.spec.collectScopeArray();
        if (!existingScopes.includes(endpoint.scope)) {
            throw new CFError(`Endpoint scope must be one of: ${existingScopes}`);
        }

        const finalEndpoint = _.defaultsDeep(endpoint, {
            spec: {
                acl: {
                    disableScopes: false,
                },
            },
        });

        return _.first(this._createScopeMiddleware(finalEndpoint));
    }

    _createScopeMiddleware(endpoint) {
        const self = this;
        if (!this.scopeExtractor || endpoint.spec.acl.disableScopes) {
            return [];
        }
        return [async (request, response, next) => {
            let userScope;

            if (self.scopeCondition && !(await self.scopeCondition(request, [endpoint.scope]))) {
                next();
                return;
            }

            try {
                userScope = await self.scopeExtractor(request);
            } catch (e) {
                next(e);
                return;
            }

            if (this._hasEnoughScope(userScope, endpoint.scope)) {
                next();
                return;
            }

            next(self.missingScopeHandler([endpoint.scope]));
        }];
    }

    _createAbacMiddleware(endpoint) {
        const options = endpoint.spec.acl;
        if (!options.abac) {
            return [];
        }

        const source = options.abacSource || options.resource;

        const abacFactory = this.appComponents.abac[source];
        if (!abacFactory) {
            return [];
        }

        const abacMiddleware = abacFactory(endpoint.spec.abacOptions);
        return _.isArray(abacMiddleware) ? abacMiddleware : [abacMiddleware];
    }

    _createCacheMiddleware(endpoint) {
        const cacheMeta = endpoint.spec.cache;
        if (!cacheMeta) {
            return [];
        }
        if (!this.identityExtractor) {
            console.log('Could not enable cache layer: identityExtractor is not provided');
            return [];
        }
        if (!this.components.cache.cacheStore) {
            console.log('Could not enable cache layer: cacheStore is not provided');
            return [];
        }
        return [async (req, res, next) => {
            const shouldProcessCache = await this.cacheCondition(req, cacheMeta);
            if (!shouldProcessCache) {
                next();
                return;
            }

            const { type, identifier } = cacheMeta;
            if (type === 'single') {
                const identifierValue = _.get(req, identifier);
                if (!identifierValue) {
                    console.error(`No identifier value -- skipping cache for url ${req.originalUrl}`);
                    next();
                    return;
                }
                cacheMeta.identifierValue = identifierValue;
            }
            cacheMeta.url = req.originalUrl;
            cacheMeta.identity = this.identityExtractor(req);
            if (!cacheMeta.identity) {
                console.error(`No identity value received from identityExtractor -- skipping cache for url ${req.originalUrl}`);
                next();
                return;
            }

            const cache = this.components.cache; // eslint-disable-line
            const cacheKey = cache.calculateKey(cacheMeta);
            const cachedResponse = await cache.read(cacheKey);
            if (cachedResponse) {
                console.log(`Cache exists: ${cacheKey}`);
                res.contentType('application/json');
                res.send(cachedResponse);
                return;
            }
            console.log(`Cache does not exist: ${cacheKey}`);

            const chunks = [];
            const originalEnd = res.end;
            const originalWrite = res.write;

            res.write = (chunk, encoding, cb) => {
                originalWrite.call(res, chunk, encoding, cb);
                chunks.push(chunk);
            };

            res.end = (chunk, encoding, cb) => {
                originalEnd.call(res, chunk, encoding, cb);
                if (res.statusCode !== 200) {
                    return;
                }

                if (chunk) {
                    chunks.push(chunk);
                }

                const body = Buffer.concat(chunks);

                const response = helpers.isTextContentType(res.get('content-type')) ? body.toString() : body;
                cache.store(cacheKey, response);
            };

            next();
        }];
    }

    _hasEnoughScope(userScopeArr, endpointScope) {
        let hasEnoughScope = false;
        _.forEach(userScopeArr, (userScope) => {
            hasEnoughScope = endpointScope === userScope || endpointScope.startsWith(`${userScope}:`);
            return !hasEnoughScope;
        });
        return hasEnoughScope;
    }
}

module.exports = new Endpoints();
