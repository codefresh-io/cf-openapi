const { Codefresh, Config } = require('codefresh-sdk');

const app = require('./app');
const defaults = require('../defaults');

const middleware = require('./app/server/test/test.middleware');
const controller = require('./app/server/test/test.controller');
const condition = require('./app/server/test/test.condition'); // eslint-disable-line

jest.spyOn(middleware, 'preMiddleware');
jest.spyOn(middleware, 'postMiddleware');

jest.spyOn(controller, 'endpoint');

const sdk = new Codefresh();

describe('openapi e2e', () => {
    // todo: add deps to openapi.json
    // todo: add events
    beforeAll(async () => { // eslint-disable-line
        await app.start();
        const url = `http://localhost:${app.port}`;
        sdk.configure(await Config.nonAuthenticated({
            url,
            spec: {
                url: `${url}${defaults.SPEC_PATH}`,
            },
        }));
    });

    // todo: add all tests
    it('should expose endpoint', async () => {
        const result = await sdk.test.endpoint();
        expect(result).toBe('endpoint'); // eslint-disable-line
        expect(middleware.preMiddleware).toBeCalled(); // eslint-disable-line
        expect(middleware.postMiddleware).not.toBeCalled(); // eslint-disable-line
        expect(controller.endpoint).toBeCalled(); // eslint-disable-line
    });

    afterAll(async () => { // eslint-disable-line
        await app.stop();
    });
});
