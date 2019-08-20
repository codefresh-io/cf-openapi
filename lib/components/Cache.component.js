const _ = require('lodash'); // eslint-disable-line
const Base = require('./base');


class Cache extends Base {
    constructor() {
        super();
        this._store = null;
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);

        this.components.spec.init(config);

        return this;
    }

    calculateKey(meta) {
        const {
            entity, type, identifier, url,
        } = meta;
        if (identifier) {
            return `${entity}:${type}:${identifier}:${url}`;
        }
        return `${entity}:${type}:${url}`;
    }

    read(key) {
        return this._store.read(key);
    }

    readByMetadata(meta) {
        const key = this.calculateKey(meta);
        return this.read(key);
    }

    store(key, data) {
        return this._store.write(key, data);
    }

    getCacheEvictDescriptors() {
        return [];
    }
}

module.exports = new Cache();
