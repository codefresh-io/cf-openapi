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
                    const {
                        resource: resourceName,
                        action,
                        admin,
                        scope,
                    } = accessControlOptions;

                    const adminScope = admin && 'admin';
                    const hasWriteScope = ['update', 'create', 'delete'].includes(action)
                        || (!action && ['post', 'put', 'patch', 'delete'].includes(httpMethod));
                    const hasReadScope = action === 'read' || (!action && httpMethod === 'get');
                    const writeScope = hasWriteScope && 'write';
                    const readScope = hasReadScope && 'read';

                    const actualResource = resourceName || _.chain(url)
                        .replace('/', '')
                        .split('/')
                        .first()
                        .value();

                    const actualScope = adminScope || scope || writeScope || readScope || action;

                    if (!scopes[actualResource]) {
                        scopes[actualResource] = [`${actualResource}`];
                    }
                    scopes[actualResource].push(`${actualResource}:${actualScope}`);
                });
            });

            this.scopeObject = _.reduce(scopes, (acc, arr, resource) => {
                acc[resource] = _.uniq(arr);
                return acc;
            }, {});
        }

        return this.scopeObject;
    }

    collectScopeArray() {
        if (!this.scopeArray) {
            this.scopeArray = _.chain(this.collectScopeObject())
                .values()
                .flatten()
                .value();
        }
        return this.scopeArray;
    }
}

module.exports = new SpecProvider();
