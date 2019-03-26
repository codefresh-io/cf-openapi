const _ = require('lodash');
const path = require('path');

const Base = require('./base');
const { makeUrl } = require('../helpers');

const defaults = require('../../defaults');

class StoreComponent extends Base {
    constructor() {
        super();
        this.specs = {};
        this.services = {};
        this.exposedSpec = null
    }

    init(config) {
        if (this.isEnabled) return;
        super.init(config);
        const {
            root,
            services,
            openapi: {
                spec,
                dependencies
            } = {}
        } = config;
        this.appRoot = root;
        this.spec = spec;
        this.services = _.pick(services, dependencies);
        this.loadExposedSpec();
    }

    listSpecs() {
        return _.cloneDeep(this.specs);
    }

    setSpec(serviceName, spec) {
        const serviceConfig = this.services[serviceName];
        if (!serviceConfig) {
            throw new Error(`Openapi spec store has no such service: ${serviceName}`);
        }
        _.set(spec, 'servers[0].url', `${makeUrl(serviceConfig)}/api`);
        this.specs[serviceName] = spec;
    }

    getSpec(serviceName) {
        return _.cloneDeep(this.specs[serviceName]);
    }

    getExposedSpec() {
        return _.cloneDeep(this.exposedSpec);
    }

    setExposedSpec(spec) {
        this.exposedSpec = spec;
    }

    loadExposedSpec() {
        console.log('loadExposedSpec');
        const config = this.spec;
        if (!config) {
            return;
        }

        const specPath = path.resolve(this.appRoot, config.filename || defaults.SPEC_FILENAME);
        if (!require.resolve(specPath)) {
            throw new Error(`openapi.json does not exist at path: ${specPath}`);
        }
        this.exposedSpec = require(specPath);
    }

    setExposedSpecPath(path) {
        _.set(this, 'spec.filename', path);
        this.loadExposedSpec();
    }
}

module.exports = new StoreComponent();
