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
                .map(cacheSpec => _.map(cacheSpec.evict, event => _.assign({}, cacheSpec, { event })))
                .flatten()
                .map((cacheSpec) => {
                    const { entity, type } = cacheSpec;
                    return {
                        event: cacheSpec.event,
                        handler: async (event) => {
                            const meta = _.merge(_.pick(cacheSpec, 'entity', 'type'), event);
                            const key = this.calculateEvictionKey(meta);
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
