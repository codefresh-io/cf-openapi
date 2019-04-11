const _ = require('lodash');
const { Codefresh, Config } = require('codefresh-sdk');
const Promise = require('bluebird');
const CFError = require('cf-errors');

const FREE_PORT = 0;
const LOCAL_HOST = 'http://localhost';

class EndpointsTester {
    constructor({ appFn, openapi, port }) {
        this.appFn = appFn;
        this.endpoints = openapi.components.endpoints;
        this.spec = openapi.components.spec;
        this.port = port || FREE_PORT;
        this.sdk = new Codefresh();
        this.errors = [];
    }

    async execute() {
        let server;
        try {
            this.wrapEndpointRegisterFunction();
            server = await this.startApp();
            await this.configureSdk();

            await this.testEndpoints();
        } finally {
            if (server && _.isFunction(server.close)) {
                server.close();
            }
        }
        return this.errors;
    }

    async configureSdk() {
        this.sdk.configure(await Config.nonAuthenticated({
            url: `${LOCAL_HOST}:${this.port}`,
            spec: {
                url: `${LOCAL_HOST}:${this.port}${this.endpoints.getSpecPath()}`,
            },
        }));
    }

    async startApp() {
        const app = await this.appFn();
        const server = await Promise.fromCallback(cb => app.listen(this.port, cb));
        this.port = server.address().port;
        return server;
    }

    wrapEndpointRegisterFunction() {
        const _register = this.endpoints._register.bind(this.endpoints);
        this.endpoints._register = (app, httpMethod, finalRoute, endpointPreMiddleware, endpointHandler, endpointPostMiddleware) => {
            const preMiddleware = _.map(endpointPreMiddleware, () => (req, res, next) => next());
            const postMiddleware = _.map(endpointPostMiddleware, () => (req, res, next) => next());
            const handler = (req, res, next) => {
                res.send(`${_.toUpper(httpMethod)} ${finalRoute}`);
                if (!_.isEmpty(postMiddleware)) next();
            };
            return _register(app, httpMethod, finalRoute, preMiddleware, handler, postMiddleware);
        };
    }

    async testEndpoints() {
        const spec = this.spec.get();
        const promises = [];
        _.forEach(spec.paths, (resource, path) => _.forEach(resource, (method, methodName) => {
            const endpoint = method['x-endpoint'];
            if (!endpoint) {
                console.log(`Endpoint not verified - no x-endpoint for path: ${methodName} ${path}`);
                return;
            }

            if (endpoint.condition) {
                const condition = this.endpoints._resolveMeta(this.endpoints.condition, endpoint.condition);
                if (condition && !condition()) {
                    console.log(`Conditional endpoint is not verified - condition is false for path: ${methodName} ${path}`);
                    return;
                }
            }
            const params = _.chain(method.parameters)
                .map(p => (!p.$ref ? p : this._resolveRef(spec, p)))
                .filter(p => p.in === 'path')
                .reduce((acc, p) => _.merge(acc, { [p.name]: p.name }), {})
                .value();
            const operation = method['x-sdk-interface'];
            const sdkCall = _.get(this.sdk, operation);
            promises.push(sdkCall(params)
                .then(() => Promise.reject(new CFError('asdf')))
                .catch(error => this.errors.push({ path, error })));
        }));
        await Promise.all(promises);
    }

    _resolveRef(spec, param) {
        const path = param.$ref.replace('#/', '').replace(/\//g, '.');
        return _.get(spec, path);
    }

    failOnErrors() {
        if (!_.isEmpty(this.errors)) {
            const message = _.chain(this.errors)
                .map(e => `Failed to ping path: ${e.path}:\n${e.error}`)
                .join('\n\n')
                .value();
            throw new CFError(message);
        }
    }

    static async verifyEndpoints({ appFn, openapi, port }) {
        const tester = new EndpointsTester({ appFn, openapi, port });
        await tester.execute();
        tester.failOnErrors();
    }
}


module.exports = EndpointsTester.verifyEndpoints;

