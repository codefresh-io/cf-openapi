const _ = require('lodash'); // eslint-disable-line
const Base = require('./base');


class Cache extends Base {
    constructor() {
        super();
        this.cacheStore = null;
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
            entity, type, identifierValue, url,
        } = meta;
        if (type === 'single') {
            return `${entity}:${type}:${identifierValue}:${url}`;
        }
        return `${entity}:${type}:${url}`;
    }

    read(key) {
        console.log(`Cache read: ${key}`)
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

    getCacheEvictDescriptors() {
        return [];
    }
}

module.exports = new Cache();
