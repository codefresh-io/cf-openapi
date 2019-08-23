const _ = require('lodash');

const Base = require('./base');

class Events extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);
        this.components.cache.init(config);
        this.components.services.init(config);
        this.components.dependencies.init(config);

        const {
            openapi: {
                spec,
            } = {},
        } = config;

        this.spec = spec;
        this.subscribeInterface = null;
        this.publishInterface = null;
        this.subscribeCacheEvictInterface = null;

        return this;
    }

    setPublishInterface(publishInterface) {
        this.publishInterface = publishInterface;
    }

    setSubscribeInterface(subscribeInterface) {
        this.subscribeInterface = subscribeInterface;
    }

    setSubscribeCacheEvictInterface(subscribeInterface) {
        this.subscribeCacheEvictInterface = subscribeInterface;
    }

    publish() {
        if (!this.publishInterface) {
            console.log('Could not publish openapi refresh event: publish interface is not set');
            return Promise.resolve();
        }

        const spec = this.components.spec.get();
        if (!spec) {
            console.log('Could not publish openapi refresh event: openapi spec it not loaded from filesystem');
            return Promise.resolve();
        }

        const serviceName = this.components.spec.serviceName();
        if (!serviceName) {
            console.log('Could not publish openapi refresh event: service name is not specified');
            return Promise.resolve();
        }

        console.log(`Publishing openapi refresh event for service: "${serviceName}"`);
        return this.publishInterface(serviceName);
    }

    subscribe() {
        if (!this.subscribeInterface) {
            console.log('Could not subscribe openapi refresh event: subscribe interface is not set');
            return;
        }
        const services = this.components.services.all();
        if (_.isEmpty(services)) {
            console.log('Listener not registered for openapi refresh event: no dependencies inside openapi spec file');
            return;
        }

        this.subscribeInterface(async (serviceName) => {
            if (services[serviceName]) {
                console.log(`Openapi refresh event received for service: "${serviceName}"`);
                this.components.dependencies.fetchServiceSpec(serviceName);
            }
        });
        console.log(`Listener is registered for openapi refresh event. Services: [ ${_.keys(services)} ]`);
    }

    subscribeCacheEviction() {
        if (!this.subscribeCacheEvictInterface) {
            console.log('Could not subscribe cache eviction events: subscribeCacheEvictInterface interface is not set');
            return;
        }
        const evictEventDescriptors = this.components.cache.getCacheEvictDescriptors();
        if (_.isEmpty(evictEventDescriptors)) {
            console.log('Openapi spec has not cache evict descriptors');
            return;
        }

        _.forEach(evictEventDescriptors, (descriptor) => {
            const { event, handler, options } = descriptor;
            this.subscribeCacheEvictInterface(event, handler, options);
            console.log(`Cache evict event lister initialized: "${event}_${options.additionalIdentifier}"`);
        });
    }
}

module.exports = new Events();
