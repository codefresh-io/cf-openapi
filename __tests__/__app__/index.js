/* eslint-disable import/no-extraneous-dependencies */
const express = require('express');
const Promise = require('bluebird');

const config = require('./service.config');
const { openapi } = require('../../index');
const globalMiddleware = require('./server/global.middleware');
const eventsInterface = require('./events-interface');

class App {
    constructor() {
        this.server = null;
        this.port = null;
        this.app = express();
    }

    async start() {
        const deferred = Promise.defer();
        openapi.init(config);
        openapi.events().setSubscribeInterface(eventsInterface.subscribe);
        openapi.events().setPublishInterface(eventsInterface.publish);
        openapi.endpoints().addSpecMiddleware(globalMiddleware.specMiddleware);
        openapi.endpoints().addDependenciesSpecMiddleware(globalMiddleware.dependenciesSpecMiddleware);
        openapi.endpoints().addScopeEndpointMiddleware(globalMiddleware.scopesEndpointMiddleware);
        openapi.endpoints().addAbacEndpointMiddleware(globalMiddleware.abacEndpointMiddleware);
        openapi.endpoints().register(this.app);
        openapi.dependencies().fetch();
        this.server = this.app.listen(0, () => {
            openapi.events().subscribe();
            openapi.events().publish();
            deferred.resolve();
        });
        this.port = this.server.address().port;
        return deferred.promise;
    }

    async stop() {
        this.server.close();
    }
}

module.exports = new App();
