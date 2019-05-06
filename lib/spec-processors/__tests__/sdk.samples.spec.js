const processor = require('../sdk.samples.processor');

const BASE_URL = 'http://localhost';

describe('sdk samples processor', () => {
    it('should generate sdk samples with params and object properties', () => {
        const result = processor.addSdkSamples({
            servers: [
                {
                    url: BASE_URL,
                },
            ],
            paths: {
                '/banana/{name}': {
                    post: {
                        parameters: [
                            {
                                in: 'path',
                                name: 'name',
                            },
                            {
                                in: 'query',
                                name: 'type',
                            },
                            {
                                in: 'query',
                                name: 'volume',
                            },
                            {
                                in: 'query',
                                name: 'mass',
                            },
                        ],
                        'x-sdk-interface': 'banana.create',
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            string: {
                                                type: 'string',
                                            },
                                            object: {
                                                type: 'object',
                                                properties: {
                                                    one: {
                                                        type: 'object',
                                                        properties: {
                                                            two: {
                                                                type: 'array',
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            array: {
                                                type: 'array',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        expect(result).toMatchObject({
            paths: {
                '/banana/{name}': {
                    post: {
                        'x-code-samples': [{
                            lang: 'node.js',
                            source:
                                'sdk.banana.create({\n' +
                                '    name,\n' +
                                '    type,\n' +
                                '    volume,\n' +
                                '    mass\n' +
                                '}, {\n' +
                                '    string: `${STRING_STR}`,\n' + // eslint-disable-line
                                '    object: {\n' +
                                '        one: {\n' +
                                '            two: ...TWO_ARR\n' +
                                '        }\n' +
                                '    },\n' +
                                '    array: ...ARRAY_ARR\n' +
                                '})',
                        }],
                    },
                },
            },
        });
    });

    it('should generate sdk samples with params formatted inline and multi-line when more then 3 params', () => {
        const result = processor.addSdkSamples({
            servers: [
                {
                    url: BASE_URL,
                },
            ],
            paths: {
                '/banana/{name}': {
                    get: {
                        parameters: [
                            {
                                in: 'path',
                                name: 'name',
                            },
                            {
                                in: 'query',
                                name: 'type',
                            },
                            {
                                in: 'query',
                                name: 'volume',
                            },
                            {
                                in: 'query',
                                name: 'mass',
                            },
                        ],
                        'x-sdk-interface': 'banana.get',
                    },
                },
                '/beer/{name}': {
                    get: {
                        parameters: [
                            {
                                in: 'path',
                                name: 'name',
                            },
                            {
                                in: 'query',
                                name: 'type',
                            },
                        ],
                        'x-sdk-interface': 'beer.get',
                    },
                },
            },
        });
        expect(result).toMatchObject({
            paths: {
                '/banana/{name}': {
                    get: {
                        'x-code-samples': [{
                            lang: 'node.js',
                            source:
                                'sdk.banana.get({\n' +
                                '    name,\n' +
                                '    type,\n' +
                                '    volume,\n' +
                                '    mass\n' +
                                '})',

                        }],
                    },
                },
                '/beer/{name}': {
                    get: {
                        'x-code-samples': [{
                            lang: 'node.js',
                            source:
                                'sdk.beer.get({ name, type })',
                        }],
                    },
                },
            },
        });
    });
});
