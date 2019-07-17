const _ = require('lodash');

class TestArrayController {
    constructor() {
        this.arrayHandler = [
            this.middleware.bind(this),
            this.middleware.bind(this),
            this.middleware.bind(this),
            this.handler.bind(this),
        ];
        this.middlewareChecker = _.noop;
        this.handlerChecker = _.noop;
    }

    handler(req, res, next) {
        this.handlerChecker();
        res.send('array');
        next();
    }
    middleware(req, res, next) {
        this.middlewareChecker();
        console.log('array-middleware');
        next();
    }
}

module.exports = new TestArrayController();
