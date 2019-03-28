const _ = require('lodash');
const CFError = require('cf-errors');
const request = require('request-promise');
const retry = require('retry');

const Base = require('./base');

const defaults = require('../../defaults');
const { makeUrl } = require('../helpers');

class Dependencies extends Base {
    constructor() {
        super();
        this.services = {};
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);
        this.components.specProvider.init(config);
        this.components.store.init(config);
        this.components.sdkRegistry.init(config);

        const {
            services,
        } = config;

        this.services = _.pick(services, this.components.specProvider.internalServicesNames());
        return this;
    }

    fetch() {
        if (_.isEmpty(this.services)) {
            console.log('Dependencies not loaded - no dependencies specified inside openapi.json');
            return;
        }
        console.log('fetch');
        _.forEach(this.services, (config, serviceName) => {
            this.fetchServiceSpec(serviceName);
        });
    }

    fetchServiceSpec(serviceName) {
        console.log(`Fetching service spec: ${serviceName}`);
        const serviceConfig = this.services[serviceName];
        if (!serviceConfig) {
            throw new Error(`No service dependency with such name: ${serviceName}`);
        }
        const url = `${makeUrl(serviceConfig)}${defaults.SPEC_PATH}?raw`;

        const operation = retry.operation({
            forever: true,
            factor: 1,
            minTimeout: defaults.DEPENDENCIES_FETCH_RETRY_TIMEOUT,
        });
        operation.attempt(async () => {
            try {
                const spec = await request({ url, json: true, fullResponse: false });
                if (_.isEmpty(spec)) {
                    throw new Error('Retrieved spec is empty');
                }
                console.log(`Spec is loaded for ${serviceName}`);
                this.components.store.setServiceSpec(serviceName, spec);
                await this.components.sdkRegistry.reloadSdkForService(serviceName);
            } catch (err) {
                console.error(new CFError({
                    message: `Could not load openapi.json for service: "${serviceName}" form url: ${url}`,
                    cause: err,
                }).toString());
                operation.retry(err);
            }
        });
    }
}

module.exports = new Dependencies();
