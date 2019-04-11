const openapi = require('./Openapi');
const components = require('./components');
const instanceManager = require('./helpers/instances');
const verifyEndpoints = require('./helpers/endpoints-tester');

const lib = {
    openapi,
    components,
};

instanceManager.init(lib);

lib.getInstance = instanceManager.getInstance.bind(instanceManager);
lib.verifyEndpoints = verifyEndpoints;

module.exports = lib;
