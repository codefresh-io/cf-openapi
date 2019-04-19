const processor = require('../filtering.processor');

describe('filtering processor', () => {
    describe('global path filters', () => {
        it('should filter urls that match pathRegex', () => {
            const result = processor.filterBySpec({
                'x-filters': [
                    {
                        pathRegex: '\\/ban(.+)',
                    },
                    {
                        pathRegex: '(.+)eer',
                    },
                ],
                paths: {
                    '/banana': {
                        get: {},
                    },
                    '/beer': {
                        get: {},
                    },
                    '/strawberry': {
                        get: {},
                    },
                },
            });
            expect(result).toEqual(expect.objectContaining({
                paths: {
                    '/strawberry': {
                        get: {},
                    },
                },
            }));
        });
    });

    describe('global tags filters', () => {
        it('should filter methods that match tags filter', () => {
            const result = processor.filterBySpec({
                'x-filters': [
                    {
                        tags: ['banana', 'beer'],
                    },
                ],
                'x-tagGroups': [
                    {
                        tags: ['banana', 'beer', 'strawberry'],
                    },
                ],
                tags: [
                    {
                        'x-id': 'banana',
                    },
                    {
                        'x-id': 'beer',
                    },
                    {
                        'x-id': 'strawberry',
                    },
                ],
                paths: {
                    '/banana': {
                        get: {
                            tags: [
                                'banana',
                            ],
                        },
                        post: {
                            tags: [
                                'banana.but.not',
                            ],
                        },
                    },
                    '/beer': {
                        get: {
                            tags: [
                                'beer',
                            ],
                        },
                        post: {
                            tags: [
                                'beer.but.not',
                            ],
                        },
                    },
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            });
            expect(result).toEqual(expect.objectContaining({
                paths: {
                    '/banana': {
                        post: {
                            tags: [
                                'banana.but.not',
                            ],
                        },
                    },
                    '/beer': {
                        post: {
                            tags: [
                                'beer.but.not',
                            ],
                        },
                    },
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            }));
        });
    });

    describe('complex filters', () => {
        it('should filter methods that match complex filters', () => {
            const result = processor.filterBySpec({
                'x-filters': [
                    {
                        pathRegex: '\\/(banana)|(beer)',
                        methods: ['post'],
                        tags: ['hidden'],
                    },
                ],
                'x-tagGroups': [
                    {
                        tags: ['banana', 'beer', 'strawberry'],
                    },
                ],
                tags: [
                    {
                        'x-id': 'banana',
                    },
                    {
                        'x-id': 'beer',
                    },
                    {
                        'x-id': 'strawberry',
                    },
                ],
                paths: {
                    '/banana': {
                        get: {
                            tags: [
                                'banana',
                                'hidden',
                            ],
                        },
                        delete: {
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
                        post: {
                            tags: [
                                'beer',
                            ],
                        },
                    },
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            });
            expect(result).toEqual(expect.objectContaining({
                paths: {
                    '/banana': {
                        delete: {
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
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            }));
        });
    });


    describe('cleanup after filtering', () => {
        it('should remove urls that are empty after filtering', () => {
            const result = processor.filterBySpec({
                'x-filters': [
                    {
                        pathRegex: '\\/(banana)|(beer)',
                        methods: ['post'],
                    },
                ],
                paths: {
                    '/banana': {
                        post: {
                            tags: [
                                'banana',
                            ],
                        },
                    },
                    '/beer': {
                        post: {
                            tags: [
                                'beer',
                            ],
                        },
                    },
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            });
            expect(result).toEqual(expect.objectContaining({
                paths: {
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            }));
        });

        it('should remove tags that are not used after filtering', () => {
            const result = processor.filterBySpec({
                'x-filters': [
                    {
                        pathRegex: '\\/(banana)|(beer)',
                        tags: ['hidden'],
                    },
                ],
                'x-tagGroups': [
                    {
                        tags: ['banana', 'beer', 'strawberry'],
                    },
                ],
                tags: [
                    {
                        'x-id': 'banana',
                    },
                    {
                        'x-id': 'beer',
                    },
                    {
                        'x-id': 'strawberry',
                    },
                ],
                paths: {
                    '/banana': {
                        post: {
                            tags: [
                                'banana',
                                'hidden',
                            ],
                        },
                    },
                    '/beer': {
                        post: {
                            tags: [
                                'beer',
                                'hidden',
                            ],
                        },
                    },
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            });
            expect(result).toEqual(expect.objectContaining({
                'x-tagGroups': [
                    {
                        tags: ['strawberry'],
                    },
                ],
                tags: [
                    {
                        'x-id': 'strawberry',
                    },
                ],
                paths: {
                    '/strawberry': {
                        get: {
                            tags: [
                                'strawberry',
                            ],
                        },
                    },
                },
            }));
        });
    });
});
