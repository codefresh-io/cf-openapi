const _ = require('lodash');

const Base = require('./base');
const { services } = require('@codefresh-io/internal-service-config');

class Events extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.specProvider.init(config);
        this.components.store.init(config);
        this.components.sdkRegistry.init(config);

        const {
            name,
            openapi: {
                spec,
            } = {},
        } = config;

        this.appName = name;
        this.spec = spec;
        this.services = _.pick(services, this.components.specProvider.internalServicesNames());
        return this;
    }

    publish(eventbus) {
        const spec = this.components.specProvider.get();
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
        if (_.isEmpty(this.services)) {
            console.log('Listener not registered for openapi.push event: no dependencies');
            return;
        }

        eventbus.subscribe('openapi.push', async (data) => {
            const serviceName = data.aggregateId;
            if (this.services[serviceName]) {
                console.log(`Spec received through openapi.push event for service: "${serviceName}"`);
                this.components.store.setServiceSpec(serviceName, JSON.parse(data.props.spec));
                await this.components.sdkRegistry.reloadSdkForService(serviceName);
            }
        });
        console.log(`Listener is registered for openapi.push event. Services: ${_.keys(services)}`);
    }
}

module.exports = new Events();
