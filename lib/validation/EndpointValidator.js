const _ = require('lodash');
const helpers = require('../helpers/general');

const COMPONENT_REGEX = /((\w|-)+\.)+(\w|-)+/;

class EndpointValidator {
    constructor(appComponents) {
        this.appComponents = appComponents;
    }

    /**
     * @param [options.isScopeExtractorEnabled] - defines whether the system supports scopes
     */
    validate(endpoint, options = {}) {
        const errors = [];
        const { httpMethod, urlPath } = endpoint.spec;

        if (!endpoint.spec.handler) {
            errors.push({
                component: 'openapi.json',
                message: 'x-endpoint.handler property is missing',
                spec_method: httpMethod,
                spec_url: urlPath,
            });
        } else {
            errors.push(...this._validateAppComponent('controller', endpoint.spec.handler, endpoint));
        }

        const middlewareToValidate = _.union(
            endpoint.spec.preMiddleware,
            endpoint.spec.postMiddleware,
            _.get(endpoint.spec, 'auth.middleware'),
        );
        _.forEach(middlewareToValidate, (middleware) => {
            errors.push(...this._validateAppComponent('middleware', middleware, endpoint));
        });

        if (endpoint.spec.condition) {
            errors.push(...this._validateAppComponent('condition', endpoint.spec.condition, endpoint));
        }

        if (endpoint.spec.cache) {
            const {
                entity,
                type,
                evict,
                identifier,
            } = endpoint.spec.cache;

            if (!entity) {
                errors.push({
                    component: 'openapi.json',
                    message: 'x-endpoint.cache must have property "entity"',
                    spec_method: httpMethod,
                    spec_url: urlPath,
                });
            }
            if (!type) {
                errors.push({
                    component: 'openapi.json',
                    message: 'x-endpoint.cache must have property "type"',
                    spec_method: httpMethod,
                    spec_url: urlPath,
                });
            } else {
                const cacheTypes = ['single', 'list'];
                if (!cacheTypes.includes(type)) {
                    errors.push({
                        component: 'openapi.json',
                        message: `x-endpoint.cache.type must be one of ${cacheTypes}`,
                        spec_method: httpMethod,
                        spec_url: urlPath,
                    });
                }
                if (type === 'single' && !identifier) {
                    errors.push({
                        component: 'openapi.json',
                        message: 'x-endpoint.cache must have property "identifier" when type is "single"',
                        spec_method: httpMethod,
                        spec_url: urlPath,
                    });
                }
            }

            if (!_.isArray(evict)) {
                errors.push({
                    component: 'openapi.json',
                    message: 'x-endpoint.cache must have property "evict"',
                    spec_method: httpMethod,
                    spec_url: urlPath,
                });
            } else {
                _.forEach(evict, (spec, index) => {
                    const { identifier: eventIdentifier, identity, event } = spec;
                    if (!eventIdentifier) {
                        errors.push({
                            component: 'openapi.json',
                            message: `x-endpoint.cache.evict[${index}] must have property "identifier"`,
                            spec_method: httpMethod,
                            spec_url: urlPath,
                        });
                    }
                    if (!identity) {
                        errors.push({
                            component: 'openapi.json',
                            message: `x-endpoint.cache.evict[${index}] must have property "identity"`,
                            spec_method: httpMethod,
                            spec_url: urlPath,
                        });
                    }
                    if (!event) {
                        errors.push({
                            component: 'openapi.json',
                            message: `x-endpoint.cache.evict[${index}] must have property "event"`,
                            spec_method: httpMethod,
                            spec_url: urlPath,
                        });
                    }
                });
            }
        }

        if (_.get(endpoint, 'spec.acl.abac')) {
            _.forEach(endpoint.spec.abacOptions, (option) => {
                const {
                    resource: aclResource,
                    abacSource,
                } = option;
                if (!this.appComponents.abac[abacSource || aclResource]) {
                    errors.push({
                        component: 'endpoint.auth.acl',
                        message: `${abacSource || aclResource}.abac.js does not exist`,
                        spec_method: httpMethod,
                        spec_url: urlPath,
                    });
                }
            });
        }

        if (options.isScopeExtractorEnabled && !_.get(endpoint, 'spec.acl.disableScopes')) {
            const nestingComponents = endpoint.scope.split(':');
            let checkedParent = '';
            _.forEach(nestingComponents, (component) => {
                checkedParent = checkedParent ? `${checkedParent}:${component}` : component;
                if (!endpoint.spec.systemScopes.includes(checkedParent)) {
                    errors.push({
                        component: 'openapi.json',
                        message: `"${endpoint.scope}" should have parent scope "${checkedParent}"`,
                        spec_method: httpMethod,
                        spec_url: urlPath,
                    });
                }
            });
        }

        return errors;
    }

    _validateAppComponent(componentName, componentPath, endpoint) {
        return EndpointValidator.validateAppComponent(
            componentName,
            componentPath,
            this.appComponents,
            endpoint.spec.httpMethod,
            endpoint.spec.urlPath,
        );
    }

    static validateAppComponent(componentName, componentPath, appComponents, httpMethod, url) {
        const errors = [];
        const component = appComponents[componentName];
        if (!component) {
            throw new Error(`No such component: ${componentName}`);
        }

        if (!COMPONENT_REGEX.test(componentPath)) {
            errors.push({
                component: 'naming',
                message: `${componentPath} should match the regex: ${COMPONENT_REGEX}`,
                spec_method: httpMethod,
                spec_url: url,
            });
            return errors;
        }

        const [namespace, operation] = helpers.resolveComponentPath(componentPath);
        if (!component[namespace]) {
            errors.push({
                component: componentName,
                message: `no such ${componentName}: ${namespace}.${componentName}.js`,
                spec_method: httpMethod,
                spec_url: url,
            });
            return errors;
        }

        if (!component[namespace][operation]) {
            errors.push({
                component: `${namespace}.${componentName}.js`,
                message: `no such property: ${operation}`,
                spec_method: httpMethod,
                spec_url: url,
            });
        }
        return errors;
    }
}

module.exports = EndpointValidator;
