const _ = require('lodash');

const Base = require('./base');

class Events extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.specProvider.init(config);
        this.components.store.init(config);
        this.components.sdkRegistry.init(config);

        const {
            name,
            services,
            openapi: {
                spec,
            } = {},
            enabledComponents = [],
        } = config;

        this.appName = name;
        this.spec = spec;
        this.enabledComponents = enabledComponents;
        this.services = _.pick(services, this.components.specProvider.internalServicesNames());
        return this;
    }

    publish(eventbus) {
        console.log('publish');
        const spec = this.components.specProvider.get();
        if (!spec || !this.enabledComponents.includes('eventbus')) {
            console.log('Could not publish openapi.push event: spec is is missing or eventbus is not enabled');
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
        console.log('subscribe');
        if (_.isEmpty(this.services) || !this.enabledComponents.includes('eventbus')) {
            console.log('Listener not registered for openapi.push event: no dependencies or eventbus is not enabled');
            return;
        }

        eventbus.subscribe('openapi.push', async (data) => {
            const serviceName = data.aggregateId;
            if (this.services[serviceName]) {
                console.log(`Spec received for service: "${serviceName}"`);
                this.components.store.setServiceSpec(serviceName, JSON.parse(data.props.spec));
                await this.components.sdkRegistry.reloadSdkForService(serviceName);
            }
        });
    }
}

module.exports = new Events();
