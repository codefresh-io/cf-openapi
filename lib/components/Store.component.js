const _ = require('lodash');

const Base = require('./base');
const { makeUrl } = require('../helpers');


class Store extends Base {
    constructor() {
        super();
        this.specs = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);
        this.components.services.init(config);

        return this;
    }

    listServiceSpecs() {
        return _.cloneDeep(this.specs);
    }

    setServiceSpec(serviceName, spec) {
        const services = this.components.services.all();
        const serviceConfig = services[serviceName];
        if (!serviceConfig) {
            throw new Error(`Openapi spec store has no such service: "${serviceName}". Please add to openapi.json file "x-internal-services" property`); // eslint-disable-line
        }
        _.set(spec, 'servers[0].url', `${makeUrl(serviceConfig)}/api`);
        this.specs[serviceName] = spec;
    }

    getServiceSpec(serviceName) {
        return _.cloneDeep(this.specs[serviceName]);
    }
}

module.exports = new Store();
