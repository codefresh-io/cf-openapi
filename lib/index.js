const openapi = require('./Openapi');
const components = require('./components');
const errors = require('./errors');
const instanceManager = require('./helpers/instances');

const lib = {
    openapi,
    components,
    errors,
};

instanceManager.init(lib);

module.exports = lib;
module.exports.getInstance = instanceManager.getInstance.bind(instanceManager);
