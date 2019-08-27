const _ = require('lodash'); // eslint-disable-line
const Base = require('./base');


class Cache extends Base {
    constructor() {
        super();
        this.cacheStore = null;
        this.cacheEvictDescriptors = null;
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);

        return this;
    }

    setStore(store) {
        this.cacheStore = store;
    }

    calculateKey(meta) {
        const {
            entity,
            type,
            identifierValue,
            url,
            identity,
        } = meta;
        return type === 'single'
            ? `${identity}:${entity}:${type}:${identifierValue}:${url}`
            : `${identity}:${entity}:${type}:${url}`;
    }

    calculateEvictionKey(meta) {
        const {
            entity,
            type,
            identifierValue,
            identity,
        } = meta;
        return type === 'single'
            ? `${identity}:${entity}:${type}:${identifierValue}:*`
            : `${identity}:${entity}:${type}:*`;
    }

    read(key) {
        console.log(`Cache read: ${key}`);
        return this.cacheStore.read(key);
    }

    readByMetadata(meta) {
        const key = this.calculateKey(meta);
        return this.read(key);
    }

    store(key, data) {
        console.log(`Cache stored: ${key}`);
        return this.cacheStore.write(key, data);
    }

    evict(key) {
        console.log(`Cache evicted: ${key}`);
        return this.cacheStore.evict(key);
    }

    getCacheEvictDescriptors() {
        if (!this.cacheEvictDescriptors) {
            const endpoints = this.components.spec.getEndpoints();
            this.cacheEvictDescriptors = _.chain(endpoints)
                .filter(e => e.spec.cache)
                .map(e => e.spec.cache)
                .map(cacheSpec => _.map(cacheSpec.evict, evictSpec => _.assign({}, cacheSpec, { evict: evictSpec })))
                .flatten()
                .map((cacheSpec) => {
                    const {
                        evict: {
                            event: eventName,
                            identifier: identifierLocation,
                            identity: identityLocation,
                        },
                        entity,
                        type,
                    } = cacheSpec;

                    return {
                        event: eventName,
                        handler: async (event) => {
                            const identifierValue = _.get(event, identifierLocation);
                            const identity = _.get(event, identityLocation);

                            const key = this.calculateEvictionKey({
                                entity,
                                type,
                                identifierValue,
                                identity,
                            });
                            this.evict(key);
                        },
                        options: {
                            additionalIdentifier: `cache.evict.${entity}.${type}`,
                        },
                    };
                })
                .value();
        }
        return this.cacheEvictDescriptors;
    }
}

module.exports = new Cache();
