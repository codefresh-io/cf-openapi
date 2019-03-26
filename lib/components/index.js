const processor = require('./Processor.component');
const endpoints = require('./Endpoints.component');
const events = require('./Events.component');
const store = require('./Store.component');
const sdkRegistry = require('./SdkRegistry.component');
const dependencies = require('./Dependencies.component');

module.exports = {
    processor,
    events,
    endpoints,
    store,
    sdkRegistry,
    dependencies,
};
