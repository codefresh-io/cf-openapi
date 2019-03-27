const _ = require('lodash');
const path = require('path');
const services = require('@codefresh-io/internal-service-config').names;

const Base = require('./base');
const defaults = require('../../defaults');

class SpecProvider extends Base {
    constructor() {
        super();
        this.exposedSpec = null
    }

    init(config) {
        if (this.isEnabled) return;
        super.init(config);
        const {
            root,
            openapi: {
                spec,
            } = {}
        } = config;
        this.appRoot = root;
        this.spec = spec;
        this.load();
        this.validateInternalServices();
        return this;
    }

    get() {
        return _.cloneDeep(this.exposedSpec);
    }

    set(spec) {
        this.exposedSpec = spec;
    }

    load() {
        console.log('spec-provider: load');
        const specPath = path.resolve(this.appRoot, _.get(this.spec, 'filename', defaults.SPEC_FILENAME));
        if (!require.resolve(specPath)) {
            console.log(`Spec is not loaded: openapi.json does not exist at path: ${specPath}`);
            return;
        }
        this.exposedSpec = require(specPath);
    }

    internalServices() {
        return _.get(this.exposedSpec, 'x-internal-services', []);
    }

    internalServicesNames() {
        return this.internalServices().map(s => services[s]);
    }

    validateInternalServices() {
        const invalidServices = this.internalServices().filter(s => !services[s]);
        if (!_.isEmpty(invalidServices)) {
            throw new Error(`Invalid x-internal-services inside openapi.json: ${invalidServices}.\nSee the @codefresh-io/internal-service-config for available names.`);
        }
    }
}

module.exports = new SpecProvider();
