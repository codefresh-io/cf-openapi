const _ = require('lodash');

const Base = require('./base');

class Events extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);
        this.components.services.init(config);
        this.components.store.init(config);
        this.components.sdks.init(config);

        const {
            name,
            openapi: {
                spec,
            } = {},
        } = config;

        this.appName = name;
        this.spec = spec;
        return this;
    }

    publish(eventbus) {
        const spec = this.components.spec.get();
        if (!this.appName) {
            console.error('Could not publish openapi.push event: "name" property is not specified inside the service.config.js');
            return Promise.resolve();
        }

        if (!spec) {
            console.error('Could not publish openapi.push event: openapi spec file is is missing');
            return Promise.resolve();
        }

        return eventbus.publish('openapi.push', {
            aggregateId: this.appName,
            props: {
                spec: JSON.stringify(spec),
            },
        }, true);
    }

    subscribe(eventbus) {
        const services = this.components.services.all();
        if (_.isEmpty(services)) {
            console.log('Listener not registered for openapi.push event: no dependencies');
            return;
        }

        eventbus.subscribe('openapi.push', async (data) => {
            const serviceName = data.aggregateId;
            if (services[serviceName]) {
                console.log(`Spec received through openapi.push event for service: "${serviceName}"`);
                this.components.store.setServiceSpec(serviceName, JSON.parse(data.props.spec));
                await this.components.sdks.reloadSdkForService(serviceName);
            }
        });
        console.log(`Listener is registered for openapi.push event. Services: [ ${_.keys(services)} ]`);
    }
}

module.exports = new Events();
