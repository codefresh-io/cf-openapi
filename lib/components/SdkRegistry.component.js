const _ = require('lodash');

const Base = require('./base');

class SdkRegistry extends Base {
    constructor() {
        super();
        this.registry = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.specProvider.init(config);
        this.components.store.init(config);

        const {
            services,
        } = config;

        this.services = _.pick(services, this.components.specProvider.internalServicesNames());
        return this;
    }

    async reloadSdkForService(serviceName) {
        // todo : implement
        console.log(`sdk is reloaded for service: "${serviceName}"`);
    }
}

module.exports = new SdkRegistry();
