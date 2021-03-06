class GlobalMiddleware {
    constructor() {
        // problematic to mock errorMiddleware
        this._errorMiddlewareChecker = () => {
        };
    }

    errorMiddleware(error, req, res, next) {
        console.log('error-middleware');
        this._errorMiddlewareChecker(error);
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

    scopesEndpointMiddleware(req, res, next) {
        console.log('scopes middleware');
        next();
    }

    abacEndpointMiddleware(req, res, next) {
        console.log('scopes middleware');
        next();
    }
}

module.exports = new GlobalMiddleware();
