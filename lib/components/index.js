const _ = require('lodash');

const processor = require('./Processor.component');
const endpoints = require('./Endpoints.component');
const events = require('./Events.component');
const store = require('./Store.component');
const sdks = require('./Sdks.component');
const dependencies = require('./Dependencies.component');
const spec = require('./Spec.component');
const services = require('./Services.component');

const components = {
    processor,
    events,
    endpoints,
    store,
    sdks,
    dependencies,
    spec,
    services,
};

_.forEach(components, (component) => {
    component.components = components;
});

module.exports = components;
