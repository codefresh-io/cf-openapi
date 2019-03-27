const _ = require('lodash');

const processor = require('./Processor.component');
const endpoints = require('./Endpoints.component');
const events = require('./Events.component');
const store = require('./Store.component');
const sdkRegistry = require('./SdkRegistry.component');
const dependencies = require('./Dependencies.component');
const specProvider = require('./SpecProvider.component');

const components = {
    processor,
    events,
    endpoints,
    store,
    sdkRegistry,
    dependencies,
    specProvider,
};

_.forEach(components, (component) => {
    component.components = components;
});

module.exports = components;
