const _ = require('lodash'); // eslint-disable-line

const Base = require('./base');

class Sdks extends Base {
    constructor() {
        super();
        this.registry = {};
        this.services = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);
        this.components.services.init(config);
        this.components.store.init(config);

        return this;
    }

    async reloadSdkForService(serviceName) { // eslint-disable-line
        // todo : implement
    }
}

module.exports = new Sdks();
