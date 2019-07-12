const { Codefresh, Config } = require('codefresh-sdk');
const nock = require('nock');

const app = require('./__app__');
const defaults = require('../defaults');
const { openapi, errors: { DisableScopesError, MissingScopesError } } = require('../lib');
let request = require('request-promise');

const mockAbacMiddleware = jest.fn((req, res, next) => {
    console.log('abac middleware');
    next();
});
const mockAbacMiddlewareFactory = jest.fn(() => {
    console.log('abac middleware factory');
    return mockAbacMiddleware;
});
jest.mock('./__app__/server/test/test.abac.js', () => mockAbacMiddlewareFactory);
jest.mock('./__app__/server/test/test_1.abac.js', () => mockAbacMiddlewareFactory);

const mockScopeExtractor = jest.fn(() => {
    console.log('scope extractor');
    throw new DisableScopesError();
});
const mockMissingScopeHandler = jest.fn(() => {
    console.log('missing scope handler');
    return  new MissingScopesError();
});
openapi.endpoints().setScopeExtractor(mockScopeExtractor);

const budaSpec = require('./__data__/buda-openapi');
const pestSpec = require('./__data__/pest-openapi');

const eventsInterface = require('./__app__/events-interface');
const authMiddleware = require('./__app__/server/auth.middleware');
const middleware = require('./__app__/server/test/test.middleware');
const controller = require('./__app__/server/test/test.controller');
const globalMiddleware = require('./__app__/server/global.middleware');

jest.spyOn(globalMiddleware, 'scopesMiddleware');
jest.spyOn(globalMiddleware, 'errorMiddleware');

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

let abacFactoryCalls;

describe('openapi auth e2e', () => {
    beforeAll(async () => {
        await app.start();
        eventsInterface.callback('buda');
        eventsInterface.callback('pest');
        const url = `http://localhost:${app.port}`;
        sdk.configure(await Config.nonAuthenticated({
            url,
            spec: {
                url: `${url}${defaults.SPEC_PATH}`,
            },
        }));
        request = request.defaults({
            baseUrl: `http://localhost:${app.port}`,
            json: true,
        });
        abacFactoryCalls = mockAbacMiddlewareFactory.mock.calls;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exposing endpoints and middleware', () => {
        it('should expose /api/scopes', async () => {
            const result = await request(defaults.SCOPES_PATH);
            expect(result).toEqual(openapi.spec().collectScopeObject());
            expect(globalMiddleware.scopesMiddleware).toBeCalled();
        });

        it('should expose auth-endpoint and call middleware in order auth->scope->abac->logic', async () => {
            const result = await sdk.test.authEndpoint();
            expect(result).toBe('auth');
            expect(authMiddleware.isAuthenticated).toHaveBeenCalledBefore(mockScopeExtractor);
            expect(mockScopeExtractor).toHaveBeenCalledBefore(mockAbacMiddleware);
            expect(mockAbacMiddleware).toHaveBeenCalledBefore(middleware.preMiddleware);
            expect(middleware.postMiddleware).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });

        it('should not call abac middleware when abac does not exist for this resource', async () => {
            const result = await sdk.test.auth.withoutAbac();
            expect(result).toBe('auth');
            expect(mockAbacMiddleware).not.toBeCalled();
            expect(mockScopeExtractor).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });

        it('should not call abac middleware when disableAbac is passed', async () => {
            const result = await sdk.test.auth.abacDisabled();
            expect(result).toBe('auth');
            expect(mockAbacMiddleware).not.toBeCalled();
            expect(mockScopeExtractor).toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });

        it('should not call scopes middleware when disableScope is passed', async () => {
            const result = await sdk.test.auth.scopesDisabled();
            expect(result).toBe('auth');
            expect(mockAbacMiddleware).toBeCalled();
            expect(mockScopeExtractor).not.toBeCalled();
            expect(controller.authEndpoint).toBeCalled();
        });
    });

    describe('scopes logic', () => {
        beforeEach(() => {
            openapi.endpoints().setScopeExtractor(mockScopeExtractor);
            openapi.endpoints().setMissingScopeHandler(mockMissingScopeHandler);
        });

        it('should allow access to endpoint if DisableScopesError was thrown', async () => {
            const result = await sdk.test.scopes.common();
            expect(result).toBe('auth');
            expect(mockScopeExtractor).toBeCalled();
            expect(mockMissingScopeHandler).toBeCalled();
            expect(mockScopeExtractor.mock.results[0].value).toBeInstanceOf(DisableScopesError);
            expect(controller.authEndpoint).toBeCalled();
        });

        it('should pass error to next function if error is not of type DisableScopesError', async () => {
            const CustomError = class extends Error {};
            const scopeExtractorWithError = jest.fn(() => {
                throw new CustomError();
            });
            openapi.endpoints().setScopeExtractor(scopeExtractorWithError);
            await expect(sdk.test.scopes.common()).rejects.toThrow();
            expect(scopeExtractorWithError).toBeCalled();
            expect(scopeExtractorWithError.mock.results[0].value).toBeInstanceOf(CustomError);
            expect(controller.authEndpoint).not.toBeCalled();
            expect(globalMiddleware.errorMiddleware()).toBeCalled(); // todo: type error
        });

        //todo : finish
        it('should pass MissingScopesError to next if user have not enough scope and missingScopeHandler is not set', async () => {
        });

        it('should pass result of missingScopeHandler to the next function if user have not enough scope', async () => {
        });

        it('should allow access when user have admin scope for this resource', async () => {
        });

        it('should allow access when endpoint required scope starts with user scope', async () => {
        });

        it('should require read scope when neither action nor scope not specified and method is GET', async () => {
        });

        it('should require write scope when neither action nor scope not specified and method is one of: POST, PUT, PATCH, DELETE', async () => {
        });

        it('should require admin permissions when endpoint has admin property set to true', async () => {
        });

        it('should require scope from scope property when specified', async () => {
        });
    });

    describe('define acl resource and action when not specified', () => {
        it('should resolve resource from url base', async () => {
            expect(abacFactoryCalls[1][0]).toMatchObject({ resource: 'test' });
        });
        it('should interpret GET as read action', async () => {
            expect(abacFactoryCalls[1][0]).toMatchObject({ action: 'read' });
        });
        it('should interpret POST as create action', async () => {
            expect(abacFactoryCalls[2][0]).toMatchObject({ action: 'create' });
        });
        it('should interpret PUT and PATCH as update action', async () => {
            expect(abacFactoryCalls[3][0]).toMatchObject({ action: 'update' });
            expect(abacFactoryCalls[4][0]).toMatchObject({ action: 'update' });
        });
        it('should interpret DELETE as delete action', async () => {
            expect(abacFactoryCalls[5][0]).toMatchObject({ action: 'delete' });
        });
        it('should use resource from openapi when specified', async () => {
            expect(abacFactoryCalls[6][0]).toMatchObject({ resource: 'test_1' });
        });
        it('should use action from openapi when specified', async () => {
            expect(abacFactoryCalls[7][0]).toMatchObject({ action: 'test' });
        });
        it('should pass all props from acl to abac factory merged with auto-defined', async () => {
            expect(abacFactoryCalls[8][0]).toEqual({ action: 'read', resource: 'test', property: 'test' });
        });
    });


    afterAll(async () => {
        await app.stop();
    });
});
