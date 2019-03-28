const _ = require('lodash');

const Base = require('./base');
const { makeUrl } = require('../helpers');


class Store extends Base {
    constructor() {
        super();
        this.specs = {};
        this.services = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.specProvider.init(config);

        const {
            services,
        } = config;
        this.services = _.pick(services, this.components.specProvider.internalServicesNames());
        return this;
    }

    listServiceSpecs() {
        return _.cloneDeep(this.specs);
    }

    setServiceSpec(serviceName, spec) {
        const serviceConfig = this.services[serviceName];
        if (!serviceConfig) {
            throw new Error(`Openapi spec store has no such service: ${serviceName}`);
        }
        _.set(spec, 'servers[0].url', `${makeUrl(serviceConfig)}/api`);
        this.specs[serviceName] = spec;
    }

    getServiceSpec(serviceName) {
        return _.cloneDeep(this.specs[serviceName]);
    }
}

module.exports = new Store();
