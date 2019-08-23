/* eslint-disable import/no-extraneous-dependencies */
const express = require('express');
const Promise = require('bluebird');
const _ = require('lodash');

const config = require('./service.config');
const { openapi } = require('../../index');
const globalMiddleware = require('./server/global.middleware');
const eventsInterface = require('./events-interface');

class App {
    constructor() {
        this.server = null;
        this.port = null;
        this.servers = [];
    }

    async init() {
        this.app = express();
        openapi.init(config);
        openapi.events().setSubscribeInterface(eventsInterface.subscribe);
        openapi.events().setPublishInterface(eventsInterface.publish);
        openapi.events().setSubscribeCacheEvictInterface(eventsInterface.subscribeCacheEvictInterface);
        openapi.cache().setStore({
            read: _.noop,
            write: _.noop,
            evict: _.noop,
        });
        openapi.endpoints().addSpecMiddleware(globalMiddleware.specMiddleware);
        openapi.endpoints().addDependenciesSpecMiddleware(globalMiddleware.dependenciesSpecMiddleware);
        openapi.endpoints().addScopeEndpointMiddleware(globalMiddleware.scopesEndpointMiddleware);
        openapi.endpoints().addAbacEndpointMiddleware(globalMiddleware.abacEndpointMiddleware);
        openapi.endpoints().setIdentityExtractor(_.noop);
    }

    async start() {
        const deferred = Promise.defer();
        openapi.endpoints().register(this.app);
        openapi.dependencies().fetch();
        this.server = this.app.listen(0, () => {
            openapi.events().subscribe();
            openapi.events().publish();
            deferred.resolve();
        });
        this.servers.push(this.server);
        this.port = this.server.address().port;
        console.log(`listening on port ${this.port}`);
        return deferred.promise;
    }

    async stop() {
        return Promise.map(this.servers, (server) => {
            const deffered = Promise.defer();
            server.close(() => deffered.resolve());
            return deffered;
        });
    }
}

module.exports = new App();
