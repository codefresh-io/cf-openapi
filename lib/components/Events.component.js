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
            openapi: {
                spec,
            } = {},
        } = config;

        this.spec = spec;
        return this;
    }

    setPublishInterface(publishInterface) {
        this.publishInterface = publishInterface;
    }

    setSubscribeInterface(subscribeInterface) {
        this.subscribeInterface = subscribeInterface;
    }

    publish() {
        if (!this.publishInterface) {
            console.error('Could not publish openapi refresh event: publish interface is not set');
            return Promise.resolve();
        }

        const spec = this.components.spec.get();
        if (!spec) {
            console.error('Could not publish openapi refresh event: openapi spec file is is missing');
            return Promise.resolve();
        }

        const serviceName = this.components.spec.serviceName();
        if (!serviceName) {
            console.error('Could not publish openapi refresh event: service name is not specified');
            return Promise.resolve();
        }

        return this.publishInterface(serviceName, spec);
    }

    subscribe() {
        if (!this.publishInterface) {
            console.error('Could not subscribe openapi refresh event: subscribe interface is not set');
            return;
        }
        const services = this.components.services.all();
        if (_.isEmpty(services)) {
            console.error('Listener not registered for openapi refresh event: no dependencies inside openapi spec file');
            return;
        }

        this.subscribeInterface(async (serviceName, spec) => {
            if (services[serviceName]) {
                console.log(`Spec received through openapi refresh event for service: "${serviceName}"`);
                this.components.store.setServiceSpec(serviceName, spec);
                await this.components.sdks.reloadSdkForService(serviceName);
            }
        });
        console.log(`Listener is registered for openapi refresh event. Services: [ ${_.keys(services)} ]`);
    }
}

module.exports = new Events();
