class TestMiddleware {
    preMiddleware(req, res, next) {
        console.log('pre-middleware');
        next();
    }
    postMiddleware(req, res, next) {
        console.log('post-middleware');
        next();
    }
}

module.exports = new TestMiddleware();
