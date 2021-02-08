const { Codefresh, Config } = require('codefresh-sdk');
const nock = require('nock');

const app = require('./__app__');
const defaults = require('../defaults');
const { openapi } = require('../lib');

const budaSpec = require('./__data__/buda-openapi');
const pestSpec = require('./__data__/pest-openapi');

const authMiddleware = require('./__app__/server/auth.middleware');
const middleware = require('./__app__/server/test/test.middleware');
const controller = require('./__app__/server/test/test.controller');
const globalMiddleware = require('./__app__/server/global.middleware');

jest.spyOn(globalMiddleware, 'scopesEndpointMiddleware');
jest.spyOn(globalMiddleware, 'abacEndpointMiddleware');
jest.spyOn(globalMiddleware, '_errorMiddlewareChecker');

jest.spyOn(authMiddleware, 'isAuthenticated');
jest.spyOn(middleware, 'preMiddleware');
jest.spyOn(middleware, 'postMiddleware');

jest.spyOn(controller, 'cacheSingleEndpoint');
jest.spyOn(controller, 'cacheListEndpoint');

const sdk = new Codefresh();

let currentCache = 'cache';
const mockCacheStore = {
    read: jest.fn(async () => {
        console.log('cache store read');
        return currentCache;
    }),
    write: jest.fn(async (key, cache) => {
        console.log(`cache store write ${JSON.stringify(cache)}`);
        currentCache = cache;
        return currentCache;
    }),
    evict: jest.fn(async () => {
        console.log('cache store evict');
        currentCache = null;
        return currentCache;
    }),
};

const mockIdentityExtractor = jest.fn(() => {
    console.log('identity provider');
    return 'identity';
});

describe('openapi cache e2e', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('init', () => {
        beforeEach(async () => {
            nock('http://buda.pest')
                .get('/api/openapi.json?raw')
                .twice()
                .reply(200, budaSpec);

            nock('http://buda.pest:9001')
                .get('/api/openapi.json?raw')
                .twice()
                .reply(200, pestSpec);
            await app.init();
        });

        it('should enable cache when cache condition is true', async () => {
            const mockCacheCondition = jest.fn(() => true);
            openapi.cache().setStore(mockCacheStore);
            openapi.endpoints().setIdentityExtractor(mockIdentityExtractor);
            openapi.endpoints().setCacheCondition(mockCacheCondition);

            await app.start();
            const url = `http://localhost:${app.port}`;
            sdk.configure(await Config.nonAuthenticated({
                url,
                spec: {
                    url: `${url}${defaults.SPEC_ENDPOINT_PATH}`,
                },
            }));
            await sdk.test.cacheSingleEndpoint({ id: 'identifierValue' });
            expect(mockIdentityExtractor).toBeCalled();
            expect(mockCacheStore.read).toBeCalled();
            expect(mockCacheStore.write).not.toBeCalled();
            expect(controller.cacheSingleEndpoint).not.toBeCalled();
        });

        it('should not enable cache when cache condition is false', async () => {
            const mockCacheCondition = jest.fn(() => false);
            openapi.endpoints().setIdentityExtractor(mockIdentityExtractor);
            openapi.endpoints().setCacheCondition(mockCacheCondition);
            openapi.cache().setStore(mockCacheStore);

            await app.start();
            const url = `http://localhost:${app.port}`;
            sdk.configure(await Config.nonAuthenticated({
                url,
                spec: {
                    url: `${url}${defaults.SPEC_ENDPOINT_PATH}`,
                },
            }));
            await sdk.test.cacheSingleEndpoint();
            expect(mockIdentityExtractor).not.toBeCalled();
            expect(mockCacheStore.read).not.toBeCalled();
            expect(mockCacheStore.write).not.toBeCalled();
            expect(controller.cacheSingleEndpoint).toBeCalled();
        });

        it('should not enable cache when identity extractor is not set', async () => {
            openapi.endpoints().setIdentityExtractor(null);
            const mockStore = { read: jest.fn() };
            openapi.cache().setStore(mockStore);

            await app.start();
            const url = `http://localhost:${app.port}`;
            sdk.configure(await Config.nonAuthenticated({
                url,
                spec: {
                    url: `${url}${defaults.SPEC_ENDPOINT_PATH}`,
                },
            }));
            await sdk.test.cacheSingleEndpoint();
            expect(mockStore.read).not.toBeCalled();
            expect(controller.cacheSingleEndpoint).toBeCalled();
        });

        it('should not enable cache when cache store is not set', async () => {
            openapi.endpoints().setIdentityExtractor(mockIdentityExtractor);
            openapi.cache().setStore(null);

            await app.start();
            const url = `http://localhost:${app.port}`;
            sdk.configure(await Config.nonAuthenticated({
                url,
                spec: {
                    url: `${url}${defaults.SPEC_ENDPOINT_PATH}`,
                },
            }));
            await sdk.test.cacheSingleEndpoint();
            expect(mockIdentityExtractor).not.toBeCalled();
            expect(controller.cacheSingleEndpoint).toBeCalled();
        });
    });

    describe('logic', () => {
        beforeAll(async () => {
            nock('http://buda.pest')
                .get('/api/openapi.json?raw')
                .twice()
                .reply(200, budaSpec);

            nock('http://buda.pest:9001')
                .get('/api/openapi.json?raw')
                .twice()
                .reply(200, pestSpec);
            await app.init();
            openapi.endpoints().setIdentityExtractor(mockIdentityExtractor);
            openapi.endpoints().setCacheCondition(() => true);
            openapi.cache().setStore(mockCacheStore);
            await app.start();
            const url = `http://localhost:${app.port}`;
            sdk.configure(await Config.nonAuthenticated({
                url,
                spec: {
                    url: `${url}${defaults.SPEC_ENDPOINT_PATH}`,
                },
            }));
        });

        beforeEach(() => {
            currentCache = 'cache';
        });

        describe('read/write', () => {
            it('should read response from cache when cache exist for single', async () => {
                const result = await sdk.test.cacheSingleEndpoint({ id: 'identifierValue' });
                expect(result).toEqual('cache');
                expect(mockCacheStore.read).toBeCalledWith( // eslint-disable-line
                    'identity:test:single:identifierValue:/api/test/cache-single-endpoint?id=identifierValue',
                ); // eslint-disable-line
                expect(mockCacheStore.write).not.toBeCalled();
                expect(controller.cacheSingleEndpoint).not.toBeCalled();
            });

            it('should read response from cache when cache exist for list', async () => {
                const result = await sdk.test.cacheListEndpoint({ id: 'identifierValue' });
                expect(result).toEqual('cache');
                expect(mockCacheStore.read).toBeCalledWith('identity:test:list:/api/test/cache-list-endpoint');
                expect(mockCacheStore.write).not.toBeCalled();
                expect(controller.cacheSingleEndpoint).not.toBeCalled();
            });

            it('should store response when cache does not exist for single', async () => {
                currentCache = null;
                const result = await sdk.test.cacheSingleEndpoint({ id: 'identifierValue' });
                expect(result).toEqual('cacheSingleEndpoint');
                expect(mockCacheStore.read).toBeCalledWith( // eslint-disable-line
                    'identity:test:single:identifierValue:/api/test/cache-single-endpoint?id=identifierValue',
                ); // eslint-disable-line
                expect(mockCacheStore.write).toBeCalledWith(
                    'identity:test:single:identifierValue:/api/test/cache-single-endpoint?id=identifierValue',
                    'cacheSingleEndpoint',
                );
                expect(controller.cacheSingleEndpoint).toBeCalled();
            });

            it('should store response when cache does not exist for list', async () => {
                currentCache = null;
                const result = await sdk.test.cacheListEndpoint({ id: 'identifierValue' });
                expect(result).toEqual('cacheListEndpoint');
                expect(mockCacheStore.read).toBeCalledWith('identity:test:list:/api/test/cache-list-endpoint');
                expect(mockCacheStore.write).toBeCalledWith(
                    'identity:test:list:/api/test/cache-list-endpoint',
                    'cacheListEndpoint',
                );
                expect(controller.cacheListEndpoint).toBeCalled();
            });

            it('should skip cache when cache type is "single" and identifierValue is not provided', async () => {
                const result = await sdk.test.cacheSingleEndpoint();
                expect(result).toEqual('cacheSingleEndpoint');
                expect(mockCacheStore.read).not.toBeCalled();
                expect(mockCacheStore.write).not.toBeCalled();
                expect(controller.cacheSingleEndpoint).toBeCalled();
            });

            it('should use identity got from identityExtractor when it exists', async () => {
                const mockIdentityExtractor = jest.fn(() => 'identity'); // eslint-disable-line
                openapi.endpoints().setIdentityExtractor(mockIdentityExtractor);
                const result = await sdk.test.cacheSingleEndpoint({ id: 'identifierValue' });
                expect(result).toEqual('cache');
                expect(mockCacheStore.read).toBeCalledWith( // eslint-disable-line
                    'identity:test:single:identifierValue:/api/test/cache-single-endpoint?id=identifierValue',
                ); // eslint-disable-line
                expect(mockCacheStore.write).not.toBeCalled();
                expect(controller.cacheSingleEndpoint).not.toBeCalled();
            });

            it('should skip cache when identity is not provided from identityExtractor', async () => {
                const mockIdentityExtractor = jest.fn(() => null); // eslint-disable-line
                openapi.endpoints().setIdentityExtractor(mockIdentityExtractor);
                const result = await sdk.test.cacheSingleEndpoint({ id: 'identifierValue' });
                expect(result).toEqual('cacheSingleEndpoint');
                expect(mockCacheStore.read).not.toBeCalled();
                expect(mockCacheStore.write).not.toBeCalled();
                expect(controller.cacheSingleEndpoint).toBeCalled();
            });
        });

        describe('eviction', () => {

        });
    });


    afterAll(async () => {
        await app.stop();
    });
});
