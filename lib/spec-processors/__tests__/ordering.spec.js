const processor = require('../ordering.processor');

describe('tags processor', () => {
    it('should sort methods inside each url by (create->read->update->delete)', () => {
        const result = processor.orderBySpec({
            paths: {
                '/banana': {
                    get: {},
                    delete: {},
                    update: {},
                    create: {},
                    patch: {},
                },
                '/beer': {
                    delete: {},
                    update: {},
                },
            },
        });
        expect(result).toEqual(expect.objectContaining({
            paths: {
                '/banana': {
                    create: {},
                    get: {},
                    update: {},
                    patch: {},
                    delete: {},
                },
                '/beer': {
                    update: {},
                    delete: {},
                },
            },
        }));
    });

    it('should sort tags alphabetically', () => {
        const result = processor.orderBySpec({
            tags: [
                {
                    name: 'Beer',
                    'x-id': 'beer',
                },
                {
                    name: 'Banana',
                    'x-id': 'banana',
                },
            ],
            'x-tagGroups': [
                {
                    name: 'Group',
                    tags: [
                        'beer',
                        'banana',
                    ],
                },
            ],
        });
        expect(result).toEqual(expect.objectContaining({
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
        }));
    });
});
