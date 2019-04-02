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

    basePath() {
        return '/api'; // todo
    }

    validate() {
        if (!this.exposedSpec) {
            console.error('Could not validate openapi spec: spec is not loaded');
            return;
        }
        const serviceName = this.serviceName();
        if (!serviceName) {
            console.error(`Property "x-service-name" is not specified inside the spec: ${this.filename()}`);
        }
    }
}

module.exports = new SpecProvider();
