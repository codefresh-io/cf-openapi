const processor = require('../tags.processor');

describe('tags processor', () => {
    it('should replace x-id with real tags on paths', () => {
        const result = processor.resolveTagsNames({
            tags: [
                {
                    name: 'Banana',
                    'x-id': 'banana',
                },
                {
                    name: 'Beer',
                    'x-id': 'beer',
                },
            ],
            paths: {
                '/banana': {
                    get: {
                        tags: [
                            'banana',
                        ],
                    },
                },
                '/beer': {
                    get: {
                        tags: [
                            'beer',
                        ],
                    },
                },
            },
        });
        expect(result).toEqual(expect.objectContaining({
            paths: {
                '/banana': {
                    get: {
                        tags: [
                            'Banana',
                        ],
                    },
                },
                '/beer': {
                    get: {
                        tags: [
                            'Beer',
                        ],
                    },
                },
            },
        }));
    });

    it('should replace x-id with real tags on x-tagGroups', () => {
        const result = processor.resolveTagsNames({
            tags: [
                {
                    name: 'Banana',
                    'x-id': 'banana',
                },
                {
                    name: 'Beer',
                    'x-id': 'beer',
                },
            ],
            'x-tagGroups': [
                {
                    name: 'Group',
                    tags: [
                        'banana',
                        'beer',
                    ],
                },
            ],
        });
        expect(result).toEqual(expect.objectContaining({
            'x-tagGroups': [
                {
                    name: 'Group',
                    tags: [
                        'Banana',
                        'Beer',
                    ],
                },
            ],
        }));
    });

    it('should add dot symbol to duplicated names', () => {
        const result = processor.resolveTagsNames({
            tags: [
                {
                    name: 'Duplicated',
                    'x-id': 'duplicated_1',
                },
                {
                    name: 'Duplicated',
                    'x-id': 'duplicated_2',
                },
            ],
            'x-tagGroups': [
                {
                    name: 'Group',
                    tags: [
                        'duplicated_1',
                        'duplicated_2',
                    ],
                },
            ],
            paths: {
                '/banana': {
                    get: {
                        tags: [
                            'duplicated_1',
                        ],
                    },
                },
                '/beer': {
                    get: {
                        tags: [
                            'duplicated_2',
                        ],
                    },
                },
            },
        });
        expect(result).toEqual({
            tags: [
                {
                    name: 'Duplicated',
                    'x-id': 'duplicated_1',
                },
                {
                    name: 'Duplicated.',
                    'x-id': 'duplicated_2',
                },
            ],
            'x-tagGroups': [
                {
                    name: 'Group',
                    tags: [
                        'Duplicated',
                        'Duplicated.',
                    ],
                },
            ],
            paths: {
                '/banana': {
                    get: {
                        tags: [
                            'Duplicated',
                        ],
                    },
                },
                '/beer': {
                    get: {
                        tags: [
                            'Duplicated.',
                        ],
                    },
                },
            },
        });
    });
});
