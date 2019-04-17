class TestMiddleware {
    preMiddleware(req, res, next) {
        console.log('pre-middleware');
        next();
    }
    postMiddleware(req, res, next) {
        console.log('post-middleware');
        next();
    }
    errorMiddleware(error, req, res, next) {
        console.log('error-middleware');
        next();
    }
}

module.exports = new TestMiddleware();
