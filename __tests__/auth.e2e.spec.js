const { Codefresh, Config } = require('codefresh-sdk');
const nock = require('nock');

const app = require('./__app__');
const defaults = require('../defaults');
const { openapi, errors: { MissingScopesError } } = require('../lib');
let request = require('request-promise');

const mockAbacMiddleware = jest.fn((req, res, next) => {
    console.log('abac middleware');
    next();
});
const mockAbacMiddlewareFactory = jest.fn(() => {
    console.log('abac middleware factory');
    return mockAbacMiddleware;
});
const mockAnotherAbacMiddleware = jest.fn((req, res, next) => {
    console.log('another abac middleware');
    next();
});
const mockAnotherAbacMiddlewareFactory = jest.fn(() => {
    console.log('another abac middleware factory');
    return mockAnotherAbacMiddleware;
});
jest.mock('./__app__/server/test/test.abac.js', () => mockAbacMiddlewareFactory);
jest.mock('./__app__/server/test/test_1.abac.js', () => mockAbacMiddlewareFactory);
jest.mock('./__app__/server/test/test_2.abac.js', () => mockAnotherAbacMiddlewareFactory);

const mockScopeCondition = jest.fn(() => {
    console.log('scope condition');
    return false;
});

const mockScopeExtractor = jest.fn(() => {
    console.log('scope extractor');
    return [];
});
const mockMissingScopeHandler = jest.fn((missingScopes) => {
    console.log(`missing scope handler: ${missingScopes}`);
    return new MissingScopesError(`Missing scopes: ${missingScopes}`);
});
openapi.endpoints().setScopeCondition(mockScopeCondition);
openapi.endpoints().setScopeExtractor(mockScopeExtractor);

const cacheStore = {
    read: jest.fn(async () => {
        console.log('cache store read');
        return null;
    }),
    write: jest.fn(async () => {
        console.log('cache store write');
        return null;
    }),
    evict: jest.fn(async () => {
        console.log('cache store evict');
        return null;
    }),
};

const budaSpec = require('./__data__/buda-openapi');
const pestSpec = require('./__data__/pest-openapi');

const eventsInterface = require('./__app__/events-interface');
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

jest.spyOn(controller, 'authEndpoint');

const sdk = new Codefresh();

nock('http://buda.pest')
    .get('/api/openapi.json?raw')
    .twice()
    .reply(200, budaSpec);

nock('http://buda.pest:9001')
    .get('/api/openapi.json?raw')
    .twice()
    .reply(200, pestSpec);

const CustomError = class extends Error {};

let abacFactoryCalls;

describe('openapi auth e2e', () => {
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
        abacFactoryCalls = mockAbacMiddlewareFactory.mock.calls;
        openapi.cache().setStore(cacheStore);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exposing endpoints and middleware', () => {
        it('should expose /api/scopes', async () => {
            const result = await request(defaults.SCOPES_ENDPOINT_PATH);
            expect(result).toEqual(openapi.spec().collectScopeObject());
            expect(globalMiddleware.scopesEndpointMiddleware).toBeCalled();
        });
        it('should expose /api/abac-resources', async () => {
            const result = await request(defaults.ABAC_ENDPOINT_PATH);
            expect(result).toEqual(openapi.spec().collectAbacResources());
            expect(globalMiddleware.abacEndpointMiddleware).toBeCalled();
        });

        it('should expose auth-endpoint and call middleware in order auth->scope->abac->cache->logic', async () => {
            const result = await sdk.test.authEndpoint();
            expect(result).toBe('auth');
            expect(authMiddleware.isAuthenticated).toHaveBeenCalledBefore(mockScopeExtractor);
            expect(mockScopeCondition).toHaveBeenCalledBefore(mockAbacMiddleware);
            expect(mockAbacMiddleware).toHaveBeenCalledBefore(cacheStore.read);
            expect(cacheStore.read).toHaveBeenCalledBefore(middleware.preMiddleware);
            expect(middleware.postMiddleware).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        }).timeout(10000);

        it('should load abac for resource from explicit "abacSource" option if specified', async () => {
            const result = await sdk.test.auth.explicitAbac();
            expect(result).toBe('auth');
            expect(mockAnotherAbacMiddleware).toBeCalled();
            expect(mockAbacMiddleware).not.toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });

        it('should not call abac middleware when "abac" property is not passed', async () => {
            const result = await sdk.test.auth.abacNotEnabled();
            expect(result).toBe('auth');
            expect(mockAbacMiddleware).not.toBeCalled();
            expect(mockScopeCondition).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });

        it('should not call scopes middleware when disableScope is passed', async () => {
            const result = await sdk.test.auth.scopesDisabled();
            expect(result).toBe('auth');
            expect(mockAbacMiddleware).not.toBeCalled();
            expect(mockScopeCondition).not.toBeCalled();
            expect(mockScopeExtractor).not.toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });
    });

    describe('scopes logic', () => {
        beforeEach(() => {
            openapi.endpoints().setScopeCondition(mockScopeCondition);
            openapi.endpoints().setScopeExtractor(mockScopeExtractor);
            openapi.endpoints().setMissingScopeHandler(mockMissingScopeHandler);
        });

        it('should allow access to endpoint if scopeCondition returned false', async () => {
            const result = await sdk.test.scopes.common();
            expect(result).toBe('auth');
            expect(mockScopeCondition).toHaveReturnedWith(false);
            expect(mockScopeExtractor).not.toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).not.toBeCalled();
        });

        it('should pass error to next function if error appeared', async () => {
            const scopeExtractorWithError = jest.fn(() => {
                throw new CustomError();
            });
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractorWithError);

            await expect(sdk.test.scopes.common()).rejects.toThrow();

            expect(scopeCondition).toBeCalled();
            expect(scopeExtractorWithError).toBeCalled();
            expect(scopeExtractorWithError.mock.results[0].value).toBeInstanceOf(CustomError);
            expect(controller.authEndpoint).not.toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker.mock.calls[0][0]).toBeInstanceOf(CustomError);
        });

        it('should pass MissingScopesError to next if user have not enough scope and missingScopeHandler is not set', async () => {
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractorWithError = jest.fn(() => []);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractorWithError);

            await expect(sdk.test.scopes.common()).rejects.toThrow();

            expect(scopeCondition).toBeCalled();
            expect(scopeExtractorWithError).toBeCalled();
            expect(controller.authEndpoint).not.toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker.mock.calls[0][0]).toBeInstanceOf(MissingScopesError);
        });

        it('should pass missingScopeHandler result to the next function if user have not enough scope', async () => {
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractor = jest.fn(() => []);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractor);
            openapi.endpoints().setMissingScopeHandler(() => new CustomError());

            await expect(sdk.test.scopes.common()).rejects.toThrow();

            expect(scopeCondition).toBeCalled();
            expect(scopeExtractor).toBeCalled();
            expect(controller.authEndpoint).not.toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker.mock.calls[0][0]).toBeInstanceOf(CustomError);
        });

        it('should allow access when endpoint required scope starts with user scope', async () => {
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractor = jest.fn(() => ['test']);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractor);

            await sdk.test.scopes.read();
            await sdk.test.scopes.post();
            await sdk.test.scopes.put();
            await sdk.test.scopes.patch();
            await sdk.test.scopes.delete();
            await sdk.test.scopes.action();
            await sdk.test.scopes.scope();

            expect(scopeCondition).toBeCalledTimes(7);
            expect(scopeExtractor).toBeCalledTimes(7);
            expect(controller.authEndpoint).toBeCalledTimes(7);
            expect(globalMiddleware._errorMiddlewareChecker).not.toBeCalled();
        });

        it('should require read scope when neither action nor scope not specified and method is GET', async () => {
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractor = jest.fn(() => ['test:read']);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractor);

            const result = await sdk.test.scopes.read();

            expect(result).toBe('auth');
            expect(scopeCondition).toBeCalled();
            expect(scopeExtractor).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).not.toBeCalled();
        });

        it('should require write scope when neither action nor scope not specified and method is one of: POST, PUT, PATCH, DELETE', async () => { // eslint-disable-line
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractor = jest.fn(() => ['test:write']);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractor);

            await sdk.test.scopes.post();
            await sdk.test.scopes.put();
            await sdk.test.scopes.patch();
            await sdk.test.scopes.delete();

            expect(scopeCondition).toBeCalledTimes(4);
            expect(scopeExtractor).toBeCalledTimes(4);
            expect(controller.authEndpoint).toBeCalledTimes(4);
            expect(globalMiddleware._errorMiddlewareChecker).not.toBeCalled();
        });

        it('should require scope from action property when specified', async () => {
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractor = jest.fn(() => ['test:action']);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractor);

            const result = await sdk.test.scopes.action();

            expect(result).toBe('auth');
            expect(scopeCondition).toBeCalled();
            expect(scopeExtractor).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).not.toBeCalled();
        });

        it('should require scope from scope property when specified', async () => {
            const scopeCondition = jest.fn(() => {
                console.log('scope condition');
                return true;
            });
            const scopeExtractor = jest.fn(() => ['test:scope']);
            openapi.endpoints().setScopeCondition(scopeCondition);
            openapi.endpoints().setScopeExtractor(scopeExtractor);

            const result = await sdk.test.scopes.scope();

            expect(result).toBe('auth');
            expect(scopeCondition).toBeCalled();
            expect(scopeExtractor).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
            expect(globalMiddleware._errorMiddlewareChecker).not.toBeCalled();
        });
    });

    describe('define acl resource and action when not specified', () => {
        it('should resolve resource from url base', async () => {
            expect(abacFactoryCalls[1][0]).toMatchObject([{ resource: 'test' }]);
        });
        it('should interpret GET as read action', async () => {
            expect(abacFactoryCalls[1][0]).toMatchObject([{ action: 'read' }]);
        });
        it('should interpret POST as create action', async () => {
            expect(abacFactoryCalls[2][0]).toMatchObject([{ action: 'create' }]);
        });
        it('should interpret PUT and PATCH as update action', async () => {
            expect(abacFactoryCalls[3][0]).toMatchObject([{ action: 'update' }]);
            expect(abacFactoryCalls[4][0]).toMatchObject([{ action: 'update' }]);
        });
        it('should interpret DELETE as delete action', async () => {
            expect(abacFactoryCalls[5][0]).toMatchObject([{ action: 'delete' }]);
        });
        it('should use resource from openapi when specified', async () => {
            expect(abacFactoryCalls[6][0]).toMatchObject([{ resource: 'test_1' }]);
        });
        it('should use action from openapi when specified', async () => {
            expect(abacFactoryCalls[7][0]).toMatchObject([{ action: 'test' }]);
        });
        it('should pass all props from acl to abac factory as array of objects defaulted from auto-defined', async () => {
            expect(abacFactoryCalls[8][0]).toEqual([{
                abac: true,
                action: 'read',
                resource: 'test',
                property: 'test',
                httpMethod: 'get',
                urlPath: '/test/auth/with-additional-properties',
            }]);
        });
        it('should pass all abacOptions from acl to abac factory as array of objects defaulted from acl', async () => {
            expect(abacFactoryCalls[9][0]).toMatchObject([
                {
                    action: 'read',
                    resource: 'test',
                    description: 'test',
                },
                {
                    action: 'custom',
                    resource: 'test',
                    description: 'custom',
                },
            ]);
        });
    });


    afterAll(async () => {
        await app.stop();
    });
});
