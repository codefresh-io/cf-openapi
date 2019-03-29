class Base {
    constructor() {
        this.config = {};
        this.isEnabled = false;
        this.components = {};
    }

    init(config) {
        this.config = config;
        this.isEnabled = true;
        return this;
    }
}

module.exports = Base;
