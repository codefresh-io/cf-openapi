const _ = require('lodash');

const { endpoints, events, dependencies, store } = require('./components');

class Openapi {
    constructor() {
        this.config = {};
    }

    init(config) {
        this.config = config;
        store.init(config);
        endpoints.init(config);
        events.init(config);
        dependencies.init(config);
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
        endpoints.register(app);
        events.publishOpenapiPushEvent(eventbus);
        events.subscribeOpenapiPushEvents(eventbus);

        // async fetch dependency
        dependencies.fetch();
    }

    endpoints() {
        return endpoints;
    }

    dependencies() {
        return dependencies;
    }

    events() {
        return events;
    }

    store() {
        return store;
    }
}

module.exports = new Openapi();
