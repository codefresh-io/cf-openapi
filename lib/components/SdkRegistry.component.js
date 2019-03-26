const _ = require('lodash');
const store = require('./Store.component');

const Base = require('./base');

class SdkRegistry extends Base {
    constructor() {
        super();
        this.registry = {};
    }

    init(config) {
        if (this.isEnabled) return;
        super.init(config);
        store.init(config);

        const {
            services,
            openapi: {
                dependencies
            } = {}
        } = config;

        this.services = _.pick(services, dependencies);
        return this;
    }

    async reloadSdkForService(serviceName) {
        // todo : implement
        console.log(`sdk is reloaded for service: "${serviceName}"`);
    }
}

module.exports = new SdkRegistry();
