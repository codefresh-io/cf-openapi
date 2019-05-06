const _ = require('lodash');

const { endpoints, spec } = require('../index');

spec.appRoot = '';

describe('Endpoints component', () => {
    describe('validateAppEndpoints', () => {
        describe('no validation', () => {
            it('should not validate app endpoints if there is no spec', () => {
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should not validate app endpoints if there are no endpoints', () => {
                spec.set({ openapi: '3.0.0' });
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });
        });

        describe('validation', () => {
            const SPEC = {};

            beforeEach(() => {
                _.set(endpoints.controller, 'test.handler', () => true);
                _.set(SPEC, 'paths./test.get.x-endpoint.handler', 'test.handler');
            });

            it('should throw only when spec has global condition that does not exist in app', () => {
                _.set(endpoints.condition, 'test.condition', () => true);

                _.set(SPEC, 'x-endpoint-conditions[0].condition', 'test.not.exist'); // no such file 'test.not'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'x-endpoint-conditions[0].condition', 'test.not-exist'); // no such method 'not-exist'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'x-endpoint-conditions[0].condition', 'test.condition');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has global condition that does not match the component regex', () => {
                _.set(endpoints.condition, 'test.condition', () => true);

                _.set(SPEC, 'x-endpoint-conditions[0].condition', 'test'); // must be at least two words
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'x-endpoint-conditions[0].condition', 'test.condition');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has condition that does not exist in app', () => {
                _.set(endpoints.condition, 'test.condition', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.condition', 'test.not.exist'); // no such file 'test.not'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.condition', 'test.not-exist'); // no such method 'not-exist'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.condition', 'test.condition');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has condition that does not match the component regex', () => {
                _.set(endpoints.condition, 'test.condition', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.condition', 'test'); // must be at least two words
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.condition', 'test.condition');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has handler that does not exist in app', () => {
                _.set(endpoints.controller, 'test.handler', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.handler', 'test.not.exist'); // no such file 'test.not'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.handler', 'test.not-exist'); // no such method 'not-exist'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.handler', 'test.handler');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has handler that does not match the component regex', () => {
                _.set(endpoints.controller, 'test.handler', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.handler', 'test'); // must be at least two words
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.handler', 'test.handler');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has preMiddleware that does not exist in app', () => {
                _.set(endpoints.middleware, 'test.preMiddleware', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.preMiddleware[0]', 'test.not.exist'); // no such file 'test.not'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.preMiddleware[0]', 'test.not-exist'); // no such method 'not-exist'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.preMiddleware[0]', 'test.preMiddleware');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has preMiddleware that does not match the component regex', () => {
                _.set(endpoints.middleware, 'test.preMiddleware', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.preMiddleware[0]', 'test'); // must be at least two words
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.preMiddleware[0]', 'test.preMiddleware');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has postMiddleware that does not exist in app', () => {
                _.set(endpoints.middleware, 'test.postMiddleware', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.postMiddleware[0]', 'test.not.exist'); // no such file 'test.not'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.postMiddleware[0]', 'test.not-exist'); // no such method 'not-exist'
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.postMiddleware[0]', 'test.postMiddleware');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });

            it('should throw only when spec has postMiddleware that does not match the component regex', () => {
                _.set(endpoints.middleware, 'test.postMiddleware', () => true);

                _.set(SPEC, 'paths./test.get.x-endpoint.postMiddleware[0]', 'test'); // must be at least two words
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).toThrow();

                _.set(SPEC, 'paths./test.get.x-endpoint.postMiddleware[0]', 'test.postMiddleware');
                spec.set(SPEC);
                expect(() => endpoints.validateAppEndpoints()).not.toThrow();
            });
        });
    });
});