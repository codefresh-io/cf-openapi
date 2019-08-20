const _ = require('lodash');
const { endpoints, spec } = require('../lib/components');
const { findAppRoot } = require('../lib/helpers/general');

function endpointsValidator(openapiJson) {
    process.env.FIREBASE_SECRET = 'test';
    const appRoot = findAppRoot(process.cwd());
    endpoints.appRoot = appRoot;
    spec.appRoot = appRoot;
    endpoints.loadAppComponents();
    spec.set(openapiJson);
    endpoints.validateAppEndpoints();
}

module.exports = endpointsValidator;
