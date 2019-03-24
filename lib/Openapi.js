const _ = require('lodash');
const Promise = require('bluebird');
const request = require('requestretry');

class Openapi {
    constructor() {
        this.appConfig = {};
        this.config = {};
        this.specs = {};
    }

    init(config) {
        this.appConfig = config || {};
        this.config = this.appConfig.openapi || {};
        this.services = _.mapValues(this.config.dependencies, (config, name) => {
            const service = _.get(this.appConfig, name, {});
            return _.merge(service, config);
        });
        return this
    }

    wrapRoutes(routesFn) {
        console.log('wrapRoutes');
        return async (app, eventbus) => {
            this.registerEndpoints(app);
            this.publishOpenapiPushEvent(eventbus);

            await this.fetchDependencies();
            return routesFn(app, eventbus);
        }
    }

    async fetchDependencies() {
        if (_.isEmpty(this.services)) {
            console.log('no dependencies');
            return;
        }
        console.log('fetchDependencies');
        await this._fetchDependencies(true);

        // do not await for optional dependencies
        this._fetchDependencies();
    }


    registerEndpoints(app) {
        console.log('registerEndpoints')

    }

    publishOpenapiPushEvent(eventbus) {
        console.log('publishOpenapiPushEvent')
    }

    async fetchServiceSpec(serviceName) {
        console.log(`fetching service spec: ${serviceName}`);

        const serviceConfig = this.services[serviceName];
        if (!serviceConfig) {
            throw new Error(`No service dependency with such name: ${serviceName}`);
        }

        const { uri, port, protocol } = serviceConfig;
        const url = `${protocol}://${uri}:${port}/api/openapi.json`;

        const spec = await request({ url, json: true, fullResponse: false });

        if (!spec) {
            throw new Error(`Could not load openapi.json for service: ${serviceName}. Url: ${url}`);
        }
        console.log(spec);
        this.specs[serviceName] = spec;
    }

    _fetchDependencies(required = false) {
        const promises = _.chain(this.services)
            .keys()
            .filter(service => !!this.services[service].required === required)
            .map(name => this.fetchServiceSpec(name))
            .value();
        return Promise.all(promises);
    }
}

module.exports = new Openapi();
