const _ = require('lodash');

const Base = require('./base');

class Services extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);

        const {
            services = {},
        } = config;

        this.services = _.chain(services)
            .mapKeys(serviceConfig => serviceConfig.name)
            .pick(this.components.spec.internalServices())
            .value();
        this.validateInternalServices();
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

    validateInternalServices() {
        const invalidServices = this.components.spec.internalServices().filter(s => !this.services[s]);
        if (!_.isEmpty(invalidServices)) {
            const message = `Invalid service names inside the openapi spec "x-internal-services" property: [ ${invalidServices} ] \n`
                    + 'See the https://github.com/codefresh-io/internal-service-config for available names.';
            throw new Error(message);
        }
    }
}

module.exports = new Services();
