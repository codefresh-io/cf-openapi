const _ = require('lodash');
const helpers = require('../helpers/general');
const bodyParser = require('body-parser');

class Endpoint {
    constructor(spec) {
        this.spec = spec;
        this.errors = [];
        this.preMiddleware = [];
        this.postMiddleware = [];
        this.hanlder = null;
        this.utilityMiddleware = [];
        this.parent = null;
        this.condition = () => true;
        this.globalCondition = () => true;
        this._prepareAccessControlOptions();
        this._prepareAbacOptions();
        this._prepareUtilityOptions();
    }

    get scope() {
        const { resource, action, scope } = this.spec.acl; // eslint-disable-line
        const calculatedScope = scope || helpers.resolveScopeFromAction(action);
        return `${resource}:${calculatedScope}`;
    }

    get isEnabled() {
        return this.condition() && this.globalCondition();
    }

    prepare(parent) {
        this.parent = parent;
        this._prepareRoutePath();
        this._prepareCondition();
        this._prepareGlobalCondition();
        this._prepareHandler();
        this._preparePreMiddleware();
        this._preparePostMiddleware();
        this._prepareUtilityMiddleware();
        this.isPrepared = true;
    }

    register(app) {
        if (!this.isPrepared) {
            throw new Error(`Endpoint is not prepared: ${this}`);
        }
        if (!this.isEnabled) {
            const conditionName = !this.condition()
                ? `condition "${this.spec.condition}"`
                : `global condition ${this.spec.globalCondition}`;
            console.log(`Conditional endpoint is not registered for path "${this.spec.urlPath}": ${conditionName} is falsy`);
            return;
        }
        const finalRoute = `${this.spec.basePath}${this.routePath}`;
        app[this.spec.httpMethod](..._.concat(
            finalRoute,
            this.preMiddleware,
            this.handler,
            this.postMiddleware,
        ));
        console.log(`Endpoint registered: ${_.toUpper(this.spec.httpMethod)} ${finalRoute}`);
    }

    registerUtilityMiddleware(app) {
        if (!this.isPrepared) {
            throw new Error(`Endpoint is not prepared: ${this}`);
        }
        if (!this.isEnabled) {
            const conditionName = !this.condition()
                ? `condition "${this.spec.condition}"`
                : `global condition ${this.spec.globalCondition}`;
            console.log(`Conditional endpoint is not registered for path "${this.spec.urlPath}": ${conditionName} is falsy`);
            return;
        }
        if (_.isEmpty(this.utilityMiddleware)) {
            return;
        }

        const finalRoute = `${this.spec.basePath}${this.routePath}`;
        app[this.spec.httpMethod](..._.concat(
            finalRoute,
            this.utilityMiddleware,
        ));
        console.log(`Utility registered: ${_.toUpper(this.spec.httpMethod)} ${finalRoute}`);
    }

    _prepareAccessControlOptions() {
        const { urlPath, httpMethod, auth: { acl = {} } = {} } = this.spec;
        let { resource, action } = acl;
        if (!resource) {
            resource = helpers.resolveResourceNameFromUrl(urlPath);
        }

        if (!action) {
            action = helpers.resolveActionFromHttpMethod(httpMethod);
        }

        this.spec.acl = _.merge(acl, {
            resource,
            action,
            urlPath,
            httpMethod,
        });
    }

    _prepareAbacOptions() {
        const { abacOptions = [{}] } = this.spec.acl;
        const optionsProto = _.cloneDeep(this.spec.acl);
        _.unset(optionsProto, 'abacOptions');
        this.spec.abacOptions = _.map(abacOptions, option => _.defaultsDeep(option, optionsProto));
    }

    _prepareUtilityOptions() {
        this._prepareParserOptions();
    }

    _prepareParserOptions() {
        const PARSER_OPTIONS_KEYS = ['limit'];
        let parserOptions = _.get(this.spec, 'utility.bodyParser');
        if (!parserOptions) {
            parserOptions = {};
            _.set(this.spec, 'utility.bodyParser', parserOptions);
        }
        _.assign(parserOptions, _.pick(parserOptions, PARSER_OPTIONS_KEYS));
    }

    _prepareRoutePath() {
        const params = this.spec.urlPath.match(/{\w+}/g);
        const pathParams = helpers.reduceParams(this.spec.params, 'path');
        this.routePath = _.reduce(params, (_path, param) => {
            let _param = param.replace(/[{}]/g, '');
            if (_.get(pathParams, `${_param}.x-optional`)) { // todo: review
                _param = `${_param}?`;
            }
            return _path.replace(param, `:${_param}`);
        }, this.spec.urlPath);
    }

    _prepareHandler() {
        const {
            handler: handlerMetaPath,
            isEndpoint,
        } = this.spec;
        const handler = helpers.resolveComponent(this.parent.appComponents.controller, handlerMetaPath);
        this.handler = isEndpoint === false ? handler : this._makeEndpoint(handler);
    }

    _prepareCondition() {
        const {
            condition,
        } = this.spec;

        if (condition) {
            this.condition = helpers.resolveComponent(this.parent.appComponents.condition, condition);
        }
    }

    _prepareGlobalCondition() {
        const {
            handler,
        } = this.spec;

        const globalConditions = this.parent.components.spec.endpointConditions();
        const highestCondition = _.chain(globalConditions)
            .sortBy(c => -c.weight)
            .filter(c => c.handlerRegex && new RegExp(c.handlerRegex).test(handler))
            .first()
            .value();
        if (highestCondition) {
            this.spec.globalCondition = highestCondition.condition;
            this.globalCondition = helpers.resolveComponent(this.parent.appComponents.condition, highestCondition.condition);
        }
    }

    _preparePreMiddleware() {
        const {
            auth: {
                middleware: authMiddlewareMetaPaths = [],
            } = {},
            preMiddleware: logicMiddlewareMetaPaths = [],
            urlPath,
            httpMethod,
            abacOptions,
        } = this.spec;
        const appMiddleware = this.parent.appComponents.middleware;
        const authPreMiddleware = _.map(authMiddlewareMetaPaths, metaPath => helpers.resolveComponent(appMiddleware, metaPath));
        const scopePreMiddleware = this.parent._createScopeMiddleware(this);
        const abacPreMiddleware = this.parent._createAbacMiddleware(this);
        const cachePreMiddleware = this.parent._createCacheMiddleware(this);

        if (!_.isEmpty(abacPreMiddleware)) {
            _.forEach(abacOptions, (option) => {
                const { resource, action } = option;
                console.log(`Abac ${resource}:${action} applied for: ${_.toUpper(httpMethod)} ${urlPath}`);
            });
        }

        const logicPreMiddleware = _.map(logicMiddlewareMetaPaths, metaPath => helpers.resolveComponent(appMiddleware, metaPath));

        this.preMiddleware = _.concat(
            authPreMiddleware,
            scopePreMiddleware,
            abacPreMiddleware,
            cachePreMiddleware,
            logicPreMiddleware,
        );
    }

    _preparePostMiddleware() {
        const {
            postMiddleware: postMiddlewareMetaPaths = [],
        } = this.spec;

        // eslint-disable-next-line max-len
        this.postMiddleware = _.map(postMiddlewareMetaPaths, metaPath => helpers.resolveComponent(this.parent.appComponents.middleware, metaPath));
    }

    _prepareUtilityMiddleware() {
        const parserOptions = this.spec.utility.bodyParser;
        if (!_.isEmpty(parserOptions)) {
            this.utilityMiddleware.push(bodyParser.json(parserOptions));
        }
    }

    _makeEndpoint(fn) {
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

    toString() {
        return `${this.spec.httpMethod} ${this.spec.basePath}${this.spec.urlPath}`;
    }
}

module.exports = Endpoint;
