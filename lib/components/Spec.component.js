const _ = require('lodash');
const path = require('path');
const { nameExists } = require('@codefresh-io/internal-service-config');

const Base = require('./base');
const defaults = require('../../defaults');
const { findAppRoot } = require('../helpers');

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
        this.appRoot = root || findAppRoot();
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
        const specPath = path.resolve(this.appRoot, _.get(this.spec, 'filename', defaults.SPEC_FILENAME));
        if (!require.resolve(specPath)) {
            console.error(`Openapi spec does not exist at path: ${specPath}`);
            return;
        }
        console.log(`Spec is loaded: ${specPath}`);
        this.exposedSpec = require(specPath); // eslint-disable-line
    }

    internalServices() {
        return _.get(this.exposedSpec, 'x-internal-services', []);
    }

    validateInternalServices() {
        const invalidServices = this.internalServices().filter(s => !nameExists(s));
        if (!_.isEmpty(invalidServices)) {
            const message = `Invalid service names inside the openapi spec "x-internal-services" property: [ ${invalidServices} ] \n`
                + 'See the https://github.com/codefresh-io/internal-service-config for available names.';
            throw new Error(message);
        }
    }
}

module.exports = new SpecProvider();
