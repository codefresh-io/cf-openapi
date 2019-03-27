const _ = require('lodash');

/**
 * Typically cf-openapi will be used as a chain of singletons.
 *
 * However, there is a case when we need to use multiple system instances,
 * for example as inside cf-api.
 * */
class InstanceManager {
    constructor() {
        this.proto = null;
        this.instances = {};
    }


    init(system) {
        this.proto = _.cloneDeep(system);
    }

    getInstance(owner) {
        if (!this.instances[owner]) {
            const system = _.cloneDeep(this.proto);
            const components = _.cloneDeep(this.proto.components);
            _.forEach(components, (component) => {
                component.components = components;
            });
            system.components = components;
            system.openapi.components = components;
            this.instances[owner] = system;
        }
        return this.instances[owner];
    }
}

module.exports = new InstanceManager();
