class Base {
    constructor() {
        this.config = {};
        this.isEnabled = false
    }

    init(config) {
        this.config = config;
        this.isEnabled = true;
    }
}

module.exports = Base;
