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

    paramsEndpoint(req, res) { // eslint-disable-line
        return req.params;
    }

    paramsOptionalEndpoint(req, res) { // eslint-disable-line
        return req.params;
    }

    errorEndpoint(req, res) { // eslint-disable-line
        return req.params;
    }
}

module.exports = new TestController();
