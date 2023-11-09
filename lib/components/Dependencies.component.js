const _ = require('lodash');
const CFError = require('cf-errors');
const axios = require('axios');
const retry = require('retry');

const Base = require('./base');

const defaults = require('../../defaults');
const { makeUrl } = require('../helpers/general');

class Dependencies extends Base {
    init(config) {
        if (this.isEnabled) return this;
        super.init(config);
        this.components.services.init(config);
        this.components.store.init(config);
        this.components.sdks.init(config);

        return this;
    }

    fetch() {
        const services = this.components.services.names();
        if (_.isEmpty(services)) {
            console.log('No dependencies specified inside the spec "x-internal-services" property');
            return;
        }
        _.forEach(services, (serviceName) => {
            this.fetchServiceSpec(serviceName);
        });
    }

    fetchServiceSpec(serviceName) {
        const services = this.components.services.all();
        console.log(`Fetching openapi.json for service: "${serviceName}"`);
        const serviceConfig = services[serviceName];
        if (!serviceConfig) {
            console.error(`No service dependency with such name: ${serviceName}`);
            return;
        }
        const url = `${makeUrl(serviceConfig)}${defaults.SPEC_ENDPOINT_PATH}?raw`;

        const operation = retry.operation({
            forever: true,
            factor: 1,
            minTimeout: defaults.DEPENDENCIES_FETCH_RETRY_TIMEOUT,
        });
        operation.attempt(async () => {
            try {
                const { data: spec } = await axios(url);
                if (_.isEmpty(spec)) {
                    throw new Error('Retrieved spec is empty');
                }
                console.log(`Openapi spec is fetched for service: "${serviceName}"`);
                this.components.store.setServiceSpec(serviceName, spec);
                await this.components.sdks.reloadSdkForService(serviceName);
            } catch (err) {
                console.error(new CFError({
                    message: `Could not load openapi spec for service: "${serviceName}" form url: ${url}`,
                    cause: err,
                }).toString());
                operation.retry(err);
            }
        });
    }
}

module.exports = new Dependencies();
