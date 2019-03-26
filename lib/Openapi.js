const _ = require('lodash');
const Promise = require('bluebird');
const request = require('requestretry');
const path = require('path');

const defaults = require('../defaults');
const processor = require('./Processor');
const {handleRedocIndex, handleRedocScript} = require('./redoc');

class Openapi {
    constructor() {
        this.appConfig = {};
        this.config = {};
        this.specs = {};
        this.exposedSpec = null;
    }

    init(config) {
        this.appConfig = config || {};
        this.config = this.appConfig.openapi || {};
        this.services = _.pick(this.appConfig.services, this.config.dependencies);
        this.loadExposedSpec(path);
        return this
    }

    wrapRoutes(routesFn) {
        console.log('wrapRoutes');
        return async (app, eventbus) => {
            this.setupApp(app, eventbus);
            return routesFn(app, eventbus);
        }
    }

    setupApp(app, eventbus) {
        this.registerEndpoints(app);
        this.publishOpenapiPushEvent(eventbus);
        this.subscribeOpenapiPushEvents(eventbus);

        // async fetch dependency
        this.fetchDependencies();
    }

    async fetchDependencies() {
        if (_.isEmpty(this.services)) {
            console.log('no dependencies');
            return;
        }
        console.log('fetchDependencies');
        const promises = _.chain(this.services)
            .keys()
            .map(name => this.fetchServiceSpec(name))
            .value();
        return Promise.all(promises);
    }


    registerEndpoints(app) {
        console.log('registerEndpoints');
        this.registerSpecEndpoints(app);
        this.registerAdminSpecEndpoints(app);
        this.registerRedocEndpoints(app)
    }

    publishOpenapiPushEvent(eventbus) {
        console.log('publishOpenapiPushEvent');
        if (!this.config.spec || !(this.appConfig.enabledComponents || []).includes('eventbus')) {
            console.log('not published');
            return;
        }
        eventbus.publish('openapi.push', {
            aggregateId: this.appConfig.name,
            props: {
                spec: JSON.stringify(this.exposedSpec)
            },
        });
        console.log('published');
    }

    subscribeOpenapiPushEvents(eventbus) {
        console.log('subscribeOpenapiPushEvents');
        if (!this.config.spec || !(this.appConfig.enabledComponents || []).includes('eventbus')) {
            console.log('not published');
            return;
        }
        eventbus.subscribe('openapi.push', async (data) => {
            let serviceName = data.aggregateId;
            if (this.services[serviceName]) {
                console.log('event received');
                console.log(data);
                this.specs[serviceName] = JSON.parse(data.props.spec);
                await this.reloadSdkForService(serviceName)
            }
        });
    }

    async fetchServiceSpec(serviceName) {
        console.log(`fetching service spec: ${serviceName}`);

        const serviceConfig = this.services[serviceName];
        if (!serviceConfig) {
            throw new Error(`No service dependency with such name: ${serviceName}`);
        }

        const { uri, port, protocol } = serviceConfig;
        const url = `${protocol}://${uri}:${port}${defaults.SPEC_PATH}`;

        const spec = await request({ url, json: true, fullResponse: false });

        if (!spec) {
            throw new Error(`Could not load openapi.json for service: ${serviceName}. No spec got by url: ${url}`);
        }
        console.log(`spec is loaded for ${serviceName}`);
        this.specs[serviceName] = spec;
        await this.reloadSdkForService(serviceName)
    }

    registerSpecEndpoints(app) {
        console.log('registerSpecEndpoints');
        const config = this.config.spec;
        if (!config) {
            return;
        }

        const path = config.specPath || defaults.SPEC_PATH;
        app.get(path, (req, res) => res.send(processor.postprocess(this.exposedSpec)));
    }

    registerAdminSpecEndpoints(app) {
        console.log('registerAdminSpecEndpoints');
        const config = this.config.adminSpec;
        if (!config) {
            return;
        }

        const path = config.specPath || defaults.ADMIN_SPEC_PATH;
        app.get(path, (req, res) => res.send(processor.aggregateAdminSpec(this.specs)));
    }

    loadExposedSpec() {
        console.log('loadExposedSpec');
        const config = this.config.spec;
        if (!config) {
            console.log('no spec is exposed');
            return;
        }

        const specPath = path.resolve(this.appConfig.root, config.filename || defaults.SPEC_FILENAME);
        if (!require.resolve(specPath)) {
            throw new Error(`openapi.json does not exist at path: ${specPath}`);
        }
        this.exposedSpec = require(specPath);
    }

    registerRedocEndpoints(app) {
        const specPath = _.get(this, 'config.spec.specPath', defaults.SPEC_PATH);
        const adminSpecPath = _.get(this, 'config.adminSpec.specPath', defaults.ADMIN_SPEC_PATH);

        const specRedocPath = _.get(this, 'config.spec.redocPath');
        const adminSpecRedocPath = _.get(this, 'config.adminSpec.redocPath');

        if (!specRedocPath && !adminSpecRedocPath)
            return;

        handleRedocScript(app);

        if (specRedocPath) {
            handleRedocIndex(app, specPath, specRedocPath)
        }
        if (adminSpecRedocPath) {
            handleRedocIndex(app, adminSpecPath, adminSpecRedocPath)
        }
    }

    async reloadSdkForService(serviceName) {
        console.log(`sdk is reloaded for service: "${serviceName}"`);
        // todo : implement
    }
}

module.exports = new Openapi();
