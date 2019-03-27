class Base {
    constructor() {
        this.config = {};
        this.isEnabled = false;
        this.components = {};
    }

    init(config) {
        this.config = config;
        this.isEnabled = true;
    }
}

module.exports = Base;
