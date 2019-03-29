const _ = require('lodash');
const components = require('./components');

class Openapi {
    constructor() {
        this.config = {};
        this.components = components;
    }

    init(config) {
        _.forEach(this.components, c => c.init(config));
        return this;
    }

    endpoints() {
        return this.components.endpoints;
    }

    dependencies() {
        return this.components.dependencies;
    }

    events() {
        return this.components.events;
    }

    store() {
        return this.components.store;
    }

    processor() {
        return this.components.processor;
    }

    sdks() {
        return this.components.sdks;
    }

    spec() {
        return this.components.spec;
    }

    services() {
        return this.components.services;
    }
}

module.exports = new Openapi();
