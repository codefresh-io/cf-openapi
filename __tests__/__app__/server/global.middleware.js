class GlobalMiddleware {
    errorMiddleware(error, req, res) {
        console.log('error-middleware');
        res.status(500).send(error);
    }

    specMiddleware(req, res, next) {
        console.log('spec middleware');
        next();
    }

    dependenciesSpecMiddleware(req, res, next) {
        console.log('spec middleware');
        next();
    }

    scopesMiddleware(req, res, next) {
        console.log('scopes middleware');
        next();
    }
}

module.exports = new GlobalMiddleware();
