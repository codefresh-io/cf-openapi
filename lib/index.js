const openapi = require('./Openapi');
const components = require('./components');
const instanceManager = require('./helpers/instances');

const lib = {
    openapi,
    components,
};

instanceManager.init(lib);

module.exports = lib;
module.exports.getInstance = instanceManager.getInstance.bind(instanceManager);
