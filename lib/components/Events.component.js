const _ = require('lodash');

const Base = require('./base');
const store = require('./Store.component');
const sdkRegistry = require('./SdkRegistry.component');


class Events extends Base {
    constructor() {
        super();
        this.exposedSpec = null;
    }

    init(config) {
        if (this.isEnabled) return;
        super.init(config);

        store.init(config);
        sdkRegistry.init(config);

        const {
            name,
            services,
            openapi: {
                spec,
                dependencies,
            } = {},
            enabledComponents = []
        } = config;

        this.appName = name;
        this.spec = spec;
        this.dependencies = dependencies;
        this.enabledComponents = enabledComponents;
        this.services = _.pick(services, dependencies);
        return this;
    }

    publishOpenapiPushEvent(eventbus) {
        console.log('publishOpenapiPushEvent');
        if (!this.spec || !this.enabledComponents.includes('eventbus')) {
            console.log('not published');
            return;
        }

        return eventbus.publish('openapi.push', {
            aggregateId: this.appName,
            props: {
                spec: JSON.stringify(this.exposedSpec)
            },
        }, true);
    }

    subscribeOpenapiPushEvents(eventbus) {
        console.log('subscribeOpenapiPushEvents');
        if (!this.dependencies || !this.enabledComponents.includes('eventbus')) {
            console.log('not listening');
            return;
        }

        eventbus.subscribe('openapi.push', async (data) => {
            const serviceName = data.aggregateId;
            console.log(`openapi.push for "${serviceName}"`);
            if (this.services[serviceName]) {
                console.log('event received');
                console.log(data);
                store.setSpec(serviceName, JSON.parse(data.props.spec));
                await sdkRegistry.reloadSdkForService(serviceName)
            }
        });
    }
}

module.exports = new Events();
