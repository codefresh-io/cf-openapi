const processor = require('../curl.samples.processor');

const BASE_URL = 'http://localhost';

describe('curl samples processor', () => {
    it('should generate curl samples with path and query params', () => {
        const result = processor.addCurlSamples({
            servers: [
                {
                    url: BASE_URL,
                },
            ],
            paths: {
                '/banana': {
                    get: {
                        parameters: [
                            {
                                in: 'query',
                                name: 'type',
                            },
                        ],
                    },
                },
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
                        ],
                    },
                },
            },
        });
        expect(result).toMatchObject({
            paths: {
                '/banana': {
                    get: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X GET \\\n' +
                                '    "http://localhost/banana?type=${TYPE}"', // eslint-disable-line
                        }],
                    },
                },
                '/banana/{name}': {
                    get: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X GET \\\n' +
                                '    "http://localhost/banana/${NAME}?type=${TYPE}"', // eslint-disable-line
                        }],
                    },
                },
            },
        });
    });

    it('should generate curl samples with empty or string body', () => {
        const result = processor.addCurlSamples({
            servers: [
                {
                    url: BASE_URL,
                },
            ],
            paths: {
                '/banana': {
                    post: {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                    },
                    put: {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                    },
                                },
                            },
                        },
                    },
                    patch: {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
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
                '/banana': {
                    post: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X POST \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "\'${REQUEST_BODY_STR}\'" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                    put: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X PUT \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "${REQUEST_BODY_OBJ}" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                    patch: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X PATCH \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "${REQUEST_BODY_ARR}" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                },
            },
        });
    });

    it('should generate curl samples with array body types', () => {
        const result = processor.addCurlSamples({
            servers: [
                {
                    url: BASE_URL,
                },
            ],
            paths: {
                '/banana': {
                    post: {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                one: {
                                                    type: 'object',
                                                },
                                                two: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'string',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    put: {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: [
                                            {
                                                type: 'string',
                                            },
                                            {
                                                type: 'object',
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    patch: {
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: [
                                            {
                                                type: 'array',
                                            },
                                            {
                                                type: 'array',
                                            },
                                        ],
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
                '/banana': {
                    post: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X POST \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "[{\\"one\\":${ONE_OBJ},\\"two\\":[\\"${TWO_ARR_STR}\\"]}]" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                    put: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X PUT \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "[\\"${0_STR}\\",${1_OBJ}]" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                    patch: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X PATCH \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "[${0_ARR},${1_ARR}]" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                },
            },
        });
    });

    it('should generate curl samples with object properties', () => {
        const result = processor.addCurlSamples({
            servers: [
                {
                    url: BASE_URL,
                },
            ],
            paths: {
                '/banana': {
                    post: {
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
                '/banana': {
                    post: {
                        'x-code-samples': [{
                            lang: 'curl',
                            source:
                                'curl  \\\n' +
                                '    -X POST \\\n' +
                                '    -H \'Content-Type: application/json; charset=utf-8\' \\\n' +
                                '    -d "{\\"string\\":\\"${STRING_STR}\\",\\"object\\":{\\"one\\":{\\"two\\":${TWO_ARR}}},\\"array\\":${ARRAY_ARR}}" \\\n' + // eslint-disable-line
                                '    "http://localhost/banana"',
                        }],
                    },
                },
            },
        });
    });
});
