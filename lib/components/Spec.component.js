const _ = require('lodash');
const path = require('path');
const fs = require('fs');

const Base = require('./base');
const Endpoint = require('../models/Endpoint');
const defaults = require('../../defaults');
const dereference = require('json-schema-deref-sync');
const { findAppRoot } = require('../helpers/general');

class SpecProvider extends Base {
    constructor() {
        super();
        this.exposedSpec = null;
        this.scopeObject = null;
        this.additionalScopes = {};
        this.endpoints = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);
        const {
            root,
            openapi: {
                spec,
            } = {},
        } = config;
        this.spec = spec;
        this.appRoot = root || findAppRoot();
        this.load();
        this.validate();
        this.collectEndpoints();
        return this;
    }

    get GENERAL_SCOPES() {
        return {
            ALL: 'general',
            // READ: 'general:read',
            // WRITE: 'general:write',
        };
    }

    get() {
        return _.cloneDeep(this.exposedSpec);
    }

    set(spec) {
        this.exposedSpec = spec;
        this.scopeObject = null;
        this.collectEndpoints();
    }

    load() {
        const specPath = this.filename();
        if (!fs.existsSync(specPath)) {
            console.error(`Openapi spec does not exist at path: ${specPath}`);
            return;
        }
        console.log(`Spec is loaded: ${specPath}`);
        const spec = require(specPath); // eslint-disable-line
        this.set(spec);
    }

    filename() {
        return path.resolve(this.appRoot, _.get(this.spec, 'filename', defaults.SPEC_FILENAME));
    }

    internalServices() {
        return _.get(this.exposedSpec, 'x-internal-services', []);
    }

    serviceName() {
        return _.get(this.exposedSpec, 'x-service-name');
    }

    endpointConditions() {
        return _.get(this.exposedSpec, 'x-endpoint-conditions', []);
    }

    basePath() {
        return _.get(this.exposedSpec, 'x-base-path', '');
    }

    validate() {
        if (!this.exposedSpec) {
            console.log('Could not validate openapi spec: spec is not loaded from filesystem');
            return;
        }
        const serviceName = this.serviceName();
        if (!serviceName) {
            console.log(`Property "x-service-name" is not specified inside the spec: ${this.filename()}`);
        }
    }

    collectEndpoints() {
        if (!this.exposedSpec) {
            console.log('Could not collect endpoints: spec is not loaded from filesystem');
            return;
        }

        const dereferencedSpec = dereference(this.exposedSpec);

        _.forEach(dereferencedSpec.paths, (resource, urlPath) => {
            _.forEach(resource, (methodSpec, httpMethod) => {
                if (!methodSpec['x-endpoint']) {
                    return;
                }
                const endpointSpec = methodSpec['x-endpoint'];
                const endpointPath = `${urlPath}.${httpMethod}`;
                const params = methodSpec.parameters || [];
                const body = _.get(methodSpec, 'requestBody.content.application/json');
                const operationId = methodSpec.operationId; // eslint-disable-line
                const sdkInterface = methodSpec['x-sdk-interface'];
                const basePath = this.basePath();

                const fullEndpointSpec = _.defaultsDeep(endpointSpec, {
                    params,
                    body,
                    operationId,
                    sdkInterface,
                    urlPath,
                    httpMethod,
                    basePath,
                });
                this.endpoints[endpointPath] = new Endpoint(fullEndpointSpec);
            });
        });
        _.forEach(this.endpoints, (endpoint) => {
            endpoint.spec.systemScopes = this.collectScopeArray();
        });
    }

    // todo: rewrite
    collectScopeObject() {
        if (!this.exposedSpec) {
            console.log('Could not collect available scopes: spec is not loaded from filesystem');
            return {};
        }

        if (!this.scopeObject) {
            const scopes = {};
            _.forEach(this.exposedSpec.paths, (resource, url) => {
                _.forEach(resource, (method, httpMethod) => {
                    if (!method['x-endpoint']) {
                        return;
                    }

                    const accessControlOptions = _.get(method, 'x-endpoint.auth.acl', {});
                    if (accessControlOptions.disableScopes) {
                        return;
                    }

                    const {
                        resource: resourceName,
                        action,
                        scope,
                        description,
                    } = accessControlOptions;

                    const hasWriteScope =
                        ['update', 'create', 'delete'].includes(action) ||
                        (!action && ['post', 'put', 'patch', 'delete'].includes(httpMethod));
                    const hasReadScope =
                        action === 'read' ||
                        (!action && ['get', 'head', 'options'].includes(httpMethod));
                    const writeScope = !scope && hasWriteScope && 'write';
                    const readScope = !scope && hasReadScope && 'read';

                    const actualResource = resourceName || _.chain(url)
                        .replace('/', '')
                        .split('/')
                        .first()
                        .value();

                    const actualScope = scope || writeScope || readScope || action;
                    const actualDescription =
                        (writeScope && `Write access to ${actualResource} resource`) ||
                        (readScope && `Read access to ${actualResource} resource`) ||
                        ((scope || action) && description) || '';
                    if (!scopes[actualResource]) {
                        _.set(scopes, `${actualResource}.${actualResource}`, `Full access to ${actualResource} resource`);
                    }

                    const scopesPath = `${actualResource}.${actualResource}:${actualScope}`;
                    if (!_.get(scopes, scopesPath) || description) {
                        _.set(scopes, scopesPath, actualDescription);
                    }
                });
            });
            scopes.general = {
                [this.GENERAL_SCOPES.ALL]: 'Full access to general endpoints',
                // [this.GENERAL_SCOPES.READ]: 'Read access to general endpoints',
                // [this.GENERAL_SCOPES.WRITE]: 'Write access to general endpoints',
            };
            this.scopeObject = scopes;
        }
        _.defaultsDeep(this.scopeObject, this.additionalScopes);
        return this.scopeObject;
    }

    /**
     * Each time this function is called new scopes will be added (if not exist)
     *
     * Later these scopes will be added to return values of collectScopeArray() and collectScopeObject()
     * */
    registerAdditionalScopes(additionalScopes) {
        _.defaultsDeep(this.additionalScopes, additionalScopes);
    }

    collectScopeArray() {
        return _.chain(this.collectScopeObject())
            .values()
            .map(_.keys)
            .flatten()
            .value();
    }

    collectAbacResources() {
        if (!this.abacResources) {
            const resources = {};
            _.forEach(this.getEndpoints(), (endpoint) => {
                if (!endpoint.spec.acl.abac) {
                    return;
                }

                _.forEach(endpoint.spec.abacOptions, (option) => {
                    const {
                        resource: resourceName,
                        action,
                        description,
                    } = option;

                    const defaultDescription =
                        ['read', 'update', 'create', 'delete'].includes(action) &&
                        `${_.capitalize(action)} action on ${resourceName} resource`;
                    const actualDescription = description || defaultDescription || '';

                    const resourcePath = `${resourceName}.${action}`;
                    if (!_.get(resources, resourcePath)) {
                        _.set(resources, resourcePath, actualDescription);
                    }
                });
            });
            this.abacResources = resources;
        }
        return this.abacResources;
    }

    getEndpoints() {
        return this.endpoints || {};
    }
}

module.exports = new SpecProvider();
