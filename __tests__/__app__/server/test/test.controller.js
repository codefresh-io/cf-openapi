class TestController {
    endpoint(req, res) { // eslint-disable-line
        return 'endpoint';
    }

    nonEndpoint(req, res, next) {
        res.send('non-endpoint');
        next();
    }

    conditionalLoadedEndpoint(req, res) { // eslint-disable-line
        return 'conditional loaded';
    }

    conditionalNonLoadedEndpoint(req, res) { // eslint-disable-line
        return 'conditional non-loaded';
    }

    globalConditionalLoadedEndpoint(req, res) { // eslint-disable-line
        return 'global conditional loaded';
    }

    globalConditionalNonLoadedEndpoint(req, res) { // eslint-disable-line
        return 'global conditional loaded';
    }

    globalConditionalOverridedLoadedEndpoint(req, res) { // eslint-disable-line
        return 'global overrided loaded';
    }

    paramsEndpoint(req, res) { // eslint-disable-line
        return req.params;
    }

    paramsOptionalEndpoint(req, res) { // eslint-disable-line
        return req.params;
    }

    errorEndpoint(req, res) { // eslint-disable-line
        return Promise.reject(new Error('error'));
    }

    authEndpoint(req, res) { // eslint-disable-line
        return Promise.resolve('auth');
    }

    cacheSingleEndpoint(req, res) { // eslint-disable-line
        console.log('cache single endpoint');
        return Promise.resolve('cacheSingleEndpoint');
    }

    cacheListEndpoint(req, res) { // eslint-disable-line
        console.log('cache list endpoint');
        return Promise.resolve('cacheListEndpoint');
    }

    bodyParser(req, res) { // eslint-disable-line
        console.log('body parser endpoint');
        return req.body;
    }
}

module.exports = new TestController();
