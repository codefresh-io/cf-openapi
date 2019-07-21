const _ = require('lodash');
const path = require('path');
const fs = require('fs');

const Base = require('./base');
const defaults = require('../../defaults');
const { findAppRoot } = require('../helpers/general');

class SpecProvider extends Base {
    constructor() {
        super();
        this.exposedSpec = null;
        this.scopeObject = null;
        this.scopeArray = null;
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
        return this;
    }

    get() {
        return _.cloneDeep(this.exposedSpec);
    }

    set(spec) {
        this.exposedSpec = spec;
        this.scopeObject = null;
        this.scopeArray = null;
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
                        _.set(scopes, `${actualResource}.${actualResource}`, `Full access of ${actualResource} resource`);
                    }

                    const scopesPath = `${actualResource}.${actualResource}:${actualScope}`;
                    if (!_.get(scopes, scopesPath) || description) {
                        _.set(scopes, scopesPath, actualDescription);
                    }
                });
            });

            this.scopeObject = scopes;
        }

        return this.scopeObject;
    }

    collectScopeArray() {
        if (!this.scopeArray) {
            this.scopeArray = _.chain(this.collectScopeObject())
                .values()
                .map(_.keys)
                .flatten()
                .value();
        }
        return this.scopeArray;
    }

    collectAbacResources() {
        if (!this.abacResources) {
            const resources = {};
            _.forEach(this.exposedSpec.paths, (resource, url) => {
                _.forEach(resource, (method, httpMethod) => {
                    if (!method['x-endpoint']) {
                        return;
                    }

                    const accessControlOptions = _.get(method, 'x-endpoint.auth.acl', {});
                    // eslint-disable-next-line max-len
                    const preparedAclOptions = this.components.endpoints._prepareAccessControlOptions(accessControlOptions, url, httpMethod);

                    if (!preparedAclOptions.abac) {
                        return;
                    }

                    const preparedAbacOptions = this.components.endpoints._prepareAbacOptions(preparedAclOptions);
                    _.forEach(preparedAbacOptions, (option) => {
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
            });
            this.abacResources = resources;
        }
        return this.abacResources;
    }
}

module.exports = new SpecProvider();
