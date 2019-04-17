const express = require('express');
const Promise = require('bluebird');

const config = require('./service.config');
const { openapi } = require('../../index');

class App {
    constructor() {
        this.server = null;
        this.port = null;
        this.app = express();
    }

    async start() {
        const deferred = Promise.defer();
        openapi.init(config);
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
