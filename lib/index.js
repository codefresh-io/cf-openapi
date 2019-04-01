const openapi = require('./Openapi');
const components = require('./components');
const instanceManager = require('./helpers/instances');
const RoutesBuilder = require('./helpers/endpoints');

const lib = {
    openapi,
    components,
    buildRoutes: RoutesBuilder.build
};

instanceManager.init(lib);
lib.getInstance = instanceManager.getInstance.bind(instanceManager);

module.exports = lib;
