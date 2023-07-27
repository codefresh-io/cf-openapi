const openapi = require('./Openapi');
const components = require('./components');
const errors = require('./errors');
const instanceManager = require('./helpers/instances');
const { collectScopesObject } = require('./helpers/general');

const lib = {
    openapi,
    components,
    errors,
};

instanceManager.init(lib);

module.exports = lib;
module.exports.getInstance = instanceManager.getInstance.bind(instanceManager);
module.exports.collectScopesObject = collectScopesObject;

