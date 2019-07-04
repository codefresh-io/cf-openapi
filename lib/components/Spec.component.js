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
    }

    load() {
        const specPath = this.filename();
        if (!fs.existsSync(specPath)) {
            console.error(`Openapi spec does not exist at path: ${specPath}`);
            return;
        }
        console.log(`Spec is loaded: ${specPath}`);
        this.exposedSpec = require(specPath); // eslint-disable-line
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

    collectScopes() {
        if (!this.exposedSpec) {
            console.log('Could not collect available scopes: spec is not loaded from filesystem');
            return {};
        }

        const scopes = {};
        _.forEach(this.exposedSpec.paths, (resource, url) => {
            _.forEach(resource, (method, httpMethod) => {
                if (!method['x-endpoint']) {
                    return;
                }
                const accessControlOptions = _.get(method, 'x-endpoint.auth.access-control', {});
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
                    scopes[actualResource] = [`${actualResource}:admin`];
                }
                scopes[actualResource].push(`${actualResource}:${actualScope}`);
            });
        });

        return _.reduce(scopes, (acc, arr, resource) => {
            acc[resource] = _.uniq(arr);
            return acc;
        }, {});
    }
}

module.exports = new SpecProvider();
