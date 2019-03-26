const _ = require('lodash');
const CFError = require('cf-errors');
const request = require('request-promise');
const retry = require('retry');

const Base = require('./base');

const sdkRegistry = require('./SdkRegistry.component');
const store = require('./Store.component');

const defaults = require('../../defaults');
const { makeUrl } = require('../helpers');

class Dependencies extends Base {
    constructor() {
        super();
        this.registry = {};
    }

    init(config) {
        if (this.isEnabled) return;
        super.init(config);
        store.init(config);
        sdkRegistry.init(config);

        const {
            services,
            openapi: {
                dependencies
            } = {}
        } = config;

        this.services = _.pick(services, dependencies);
        return this;
    }

    fetch() {
        if (_.isEmpty(this.services)) {
            console.log('no dependencies');
            return;
        }
        console.log('fetch');
        _.forEach(this.services, (config, serviceName) => {
            this.fetchServiceSpec(serviceName);
        });
    }

    fetchServiceSpec(serviceName) {
        console.log(`fetching service spec: ${serviceName}`);
        const serviceConfig = this.services[serviceName];
        if (!serviceConfig) {
            throw new Error(`No service dependency with such name: ${serviceName}`);
        }
        const url = `${makeUrl(serviceConfig)}${defaults.SPEC_PATH}?raw`;

        const operation = retry.operation({
            forever: true,
            factor: 1,
            minTimeout: 5000,
        });
        operation.attempt(async () => {
            try {
                const spec = await request({ url, json: true, fullResponse: false });
                if (_.isEmpty(spec)) {
                    throw new Error('Spec is empty');
                }
                console.log(`spec is loaded for ${serviceName}`);
                store.setSpec(serviceName, spec);
                await sdkRegistry.reloadSdkForService(serviceName)
            } catch (err) {
                console.error(new CFError({
                    message: `Could not load openapi.json for service: "${serviceName}" form url: ${url}`,
                    cause: err,
                }).toString());
                operation.retry(err)
            }
        })
    }
}

module.exports = new Dependencies();
