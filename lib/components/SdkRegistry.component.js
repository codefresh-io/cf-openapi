const _ = require('lodash');

const Base = require('./base');
const { services } = require('@codefresh-io/internal-service-config');

class SdkRegistry extends Base {
    constructor() {
        super();
        this.registry = {};
        this.services = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.specProvider.init(config);
        this.components.store.init(config);

        this.services = _.pick(services, this.components.specProvider.internalServicesNames());
        return this;
    }

    async reloadSdkForService(serviceName) {
        // todo : implement
        console.log(`Sdk is reloaded for service: "${serviceName}"`);
    }
}

module.exports = new SdkRegistry();
