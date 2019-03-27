const openapi = require('./Openapi');
const components = require('./components');
const instanceManager = require('./InstanceManager');

const lib = {
    openapi,
    components,
};

instanceManager.init(lib);
lib.getInstance = instanceManager.getInstance.bind(instanceManager);

module.exports = lib;
