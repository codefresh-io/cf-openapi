const { Codefresh, Config } = require('codefresh-sdk');
const nock = require('nock');
const Promise = require('bluebird');
const fse = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');

const app = require('./__app__');
const defaults = require('../defaults');
let request = require('request-promise');

const budaSpec = require('./__data__/buda-openapi');
const pestSpec = require('./__data__/pest-openapi');

const eventsInterface = require('./__app__/events-interface');
const middleware = require('./__app__/server/test/test.middleware');
const controller = require('./__app__/server/test/test.controller');
const arrayController = require('./__app__/server/test/test.array.controller');
const globalMiddleware = require('./__app__/server/global.middleware');

jest.spyOn(globalMiddleware, '_errorMiddlewareChecker');
jest.spyOn(globalMiddleware, 'specMiddleware');
jest.spyOn(globalMiddleware, 'dependenciesSpecMiddleware');

jest.spyOn(middleware, 'preMiddleware');
jest.spyOn(middleware, 'postMiddleware');
jest.spyOn(controller, 'endpoint');
jest.spyOn(controller, 'nonEndpoint');
jest.spyOn(controller, 'nonEndpointWithNext');
jest.spyOn(controller, 'conditionalLoadedEndpoint');
jest.spyOn(controller, 'conditionalNonLoadedEndpoint');
jest.spyOn(controller, 'globalConditionalLoadedEndpoint');
jest.spyOn(controller, 'globalConditionalNonLoadedEndpoint');
jest.spyOn(controller, 'paramsEndpoint');
jest.spyOn(controller, 'paramsOptionalEndpoint');
jest.spyOn(controller, 'errorEndpoint');
jest.spyOn(controller, 'globalConditionalOverridedLoadedEndpoint');
jest.spyOn(controller, 'bodyParser');

jest.spyOn(arrayController, 'middlewareChecker');
jest.spyOn(arrayController, 'handlerChecker');

const sdk = new Codefresh();

defaults.DEPENDENCIES_FETCH_RETRY_TIMEOUT = 0;

const budaNock = nock('http://buda.pest')
    .get('/api/openapi.json?raw')
    .reply(502)
    .get('/api/openapi.json?raw')
    .twice()
    .reply(200, budaSpec);

const pestNock = nock('http://buda.pest:9001')
    .get('/api/openapi.json?raw')
    .twice()
    .reply(200, pestSpec);


describe('openapi e2e', () => {
    beforeAll(async () => {
        await app.init();
        await app.start();
        eventsInterface.callback('buda');
        eventsInterface.callback('pest');
        const url = `http://localhost:${app.port}`;
        sdk.configure(await Config.nonAuthenticated({
            url,
            spec: {
                url: `${url}${defaults.SPEC_ENDPOINT_PATH}`,
            },
        }));
        request = request.defaults({
            baseUrl: `http://localhost:${app.port}`,
            json: true,
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should listen to openapi refresh events', async () => {
        expect(eventsInterface.subscribeCalls).toBe(1);
    });

    it('should push openapi refresh event on startup', async () => {
        expect(eventsInterface.publishCalls).toBe(1);
    });

    it('should fetch dependencies', async () => {
        expect(pestNock.isDone()).toBeTruthy();
        await Promise.delay(defaults.DEPENDENCIES_FETCH_RETRY_TIMEOUT + 10);
        expect(budaNock.isDone()).toBeTruthy();
    });

    it('should expose /api/openapi.json', async () => {
        const result = await request(defaults.SPEC_ENDPOINT_PATH);
        expect(result).toHaveProperty('openapi', '3.0.0');
        expect(globalMiddleware.specMiddleware).toBeCalled();
    });

    it('should expose /api', async () => {
        const result = await request(defaults.REDOC_ENDPOINT_PATH);
        expect(result).toMatch(new RegExp(`spec-url='${defaults.SPEC_ENDPOINT_PATH}'`, 'g'));
        expect(globalMiddleware.specMiddleware).toBeCalled();
    });

    it('should expose /api/admin/openapi.json', async () => {
        const result = await request(defaults.ADMIN_SPEC_ENDPOINT_PATH);
        expect(result).toHaveProperty('openapi', '3.0.0');
        expect(globalMiddleware.dependenciesSpecMiddleware).toBeCalled();
    });

    it('should expose /api/admin', async () => {
        const result = await request(defaults.ADMIN_REDOC_ENDPOINT_PATH);
        expect(result).toMatch(new RegExp(`spec-url='${defaults.ADMIN_SPEC_ENDPOINT_PATH}'`, 'g'));
        expect(globalMiddleware.dependenciesSpecMiddleware).toBeCalled();
    });

    it('should not expose endpoint that does not exist', async () => {
        await expect(sdk.test.notExistingEndpoint()).rejects.toThrow();
    });

    it('should expose endpoint', async () => {
        const result = await sdk.test.endpoint();
        expect(result).toBe('endpoint');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.endpoint).toBeCalled();
    });

    it('should expose non-endpoint without calling next() function', async () => {
        const result = await sdk.test.nonEndpoint();
        expect(result).toBe('non-endpoint');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.nonEndpoint).toBeCalled();
    });

    it('should expose non-endpoint calling next() function', async () => {
        const result = await sdk.test.nonEndpointWithNext();
        expect(result).toBe('non-endpoint-with-next');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).toBeCalled();
        expect(controller.nonEndpointWithNext).toBeCalled();
    });

    it('should expose conditional loaded endpoint', async () => {
        const result = await sdk.test.conditionalLoadedEndpoint();
        expect(result).toBe('conditional loaded');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.conditionalLoadedEndpoint).toBeCalled();
    });

    it('should not expose conditional non-loaded endpoint', async () => {
        await expect(sdk.test.conditionalNonLoadedEndpoint()).rejects.toThrow();
        expect(middleware.preMiddleware).not.toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.conditionalNonLoadedEndpoint).not.toBeCalled();
    });

    it('should expose global conditional loaded endpoint', async () => {
        const result = await sdk.test.globalConditionalLoadedEndpoint();
        expect(result).toBe('global conditional loaded');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.globalConditionalLoadedEndpoint).toBeCalled();
    });

    it('should not expose global conditional non-loaded endpoint', async () => {
        await expect(sdk.test.globalConditionalNonLoadedEndpoint()).rejects.toThrow();
        expect(middleware.preMiddleware).not.toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.globalConditionalNonLoadedEndpoint).not.toBeCalled();
    });

    it('should not expose global conditional overrided-loaded endpoint', async () => {
        const result = await sdk.test.globalConditionalOverridedLoadedEndpoint();
        expect(result).toBe('global overrided loaded');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.globalConditionalOverridedLoadedEndpoint).toBeCalled();
    });

    it('should expose params endpoint', async () => {
        const params = {
            param_1: 'param_1',
            param_2: 'param_2',
        };
        const result = await sdk.test.paramsEndpoint(params);
        expect(result).toEqual(params);
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.paramsEndpoint).toBeCalled();
    });

    it('should expose optional params endpoint', async () => {
        const paramsWithoutOptional = {
            param_1: 'param_1',
        };
        const paramsWithOptional = {
            param_1: 'param_1',
            param_2: 'param_2',
        };

        // todo: https://codefresh-io.atlassian.net/browse/SAAS-2427
        const url = `/api/params-endpoint/optional/${paramsWithoutOptional.param_1}/`;
        const withoutOptionalResult = await request({ url });
        expect(withoutOptionalResult).toEqual(paramsWithoutOptional);

        const withOptionalResult = await sdk.test.paramsOptionalEndpoint(paramsWithOptional);
        expect(withOptionalResult).toEqual(paramsWithOptional);

        expect(middleware.preMiddleware).toBeCalledTimes(2);
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(controller.paramsOptionalEndpoint).toBeCalledTimes(2);
    });

    it('should catch errors from endpoints', async () => {
        await expect(sdk.test.errorEndpoint()).rejects.toThrow();
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).not.toBeCalled();
        expect(globalMiddleware._errorMiddlewareChecker).toBeCalled();
        expect(controller.errorEndpoint).toBeCalled();
    });

    it('should expose endpoint with array handler', async () => {
        const result = await sdk.test.arrayHandler();
        expect(result).toBe('array');
        expect(middleware.preMiddleware).toBeCalled();
        expect(middleware.postMiddleware).toBeCalled();
        expect(arrayController.middlewareChecker).toBeCalledTimes(3);
        expect(arrayController.handlerChecker).toBeCalled();
        expect(middleware.preMiddleware).toHaveBeenCalledBefore(arrayController.middlewareChecker);
        expect(arrayController.middlewareChecker).toHaveBeenCalledBefore(arrayController.handlerChecker);
        expect(arrayController.handlerChecker).toHaveBeenCalledBefore(middleware.postMiddleware);
    });

    describe('bodyParser', () => {
        let smallYaml;
        let largeYaml;

        beforeAll(async () => {
            smallYaml = await fse.readFile(path.resolve(__dirname, '__data__', 'small_file.yaml'));
            smallYaml = yaml.safeLoad(smallYaml);
            largeYaml = await fse.readFile(path.resolve(__dirname, '__data__', 'large_file.yaml'));
            largeYaml = yaml.safeLoad(largeYaml);
        });

        it('should successfully process big request body when body parser is configured to large payload', async () => {
            let result = await sdk.test.bodyParser(smallYaml);
            expect(result).toEqual(smallYaml);
            result = await sdk.test.bodyParser(largeYaml);
            expect(result).toEqual(largeYaml);

            expect(middleware.preMiddleware).toBeCalledTimes(2);
            expect(middleware.postMiddleware).not.toBeCalled();
            expect(controller.bodyParser).toBeCalledTimes(2);
        });

        it('should not register body parser when parser config not specified', async () => {
            // should have returned request body in case body parser had been specified
            let result = await sdk.test.bodyParserNonConfigured(smallYaml);
            expect(result).toEqual('');
            result = await sdk.test.bodyParserNonConfigured(largeYaml);
            expect(result).toEqual('');

            expect(middleware.preMiddleware).toBeCalledTimes(2);
            expect(middleware.postMiddleware).not.toBeCalled();
            expect(controller.bodyParser).toBeCalledTimes(2);
        });

        it('should throw 413 on body parser when configured limit is too low', async () => {
            let error;
            await expect(Promise.resolve().then(async () => {
                try {
                    await sdk.test.bodyParserSmallLimit(largeYaml)
                } catch (e) {
                    error = e;
                    throw e;
                }
            })).rejects.toThrow();
            expect(error.statusCode).toBe(413);

            expect(middleware.preMiddleware).not.toBeCalled();
            expect(middleware.postMiddleware).not.toBeCalled();
            expect(controller.bodyParser).not.toBeCalled();
        });
    });

    afterAll(async () => {
        await app.stop();
    });
});
