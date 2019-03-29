const _ = require('lodash');

const Base = require('./base');
const { services } = require('@codefresh-io/internal-service-config');

class Services extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);

        this.services = _.chain(services)
            .mapKeys(serviceConfig => serviceConfig.name)
            .pick(this.components.spec.internalServices())
            .value();
        return this;
    }

    names() {
        return _.keys(this.services);
    }

    all() {
        return _.cloneDeep(this.services);
    }

    get(serviceName) {
        return this.services[serviceName];
    }

    set(serviceName, serviceConfig) {
        this.services[serviceName] = serviceConfig;
    }
}

module.exports = new Services();
