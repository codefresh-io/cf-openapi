const { addCurlSamples } = require('./curl.samples.processor');
const { addSdkSamples } = require('./sdk.samples.processor');
const { filterBySpec } = require('./filtering.processor');
const { orderBySpec } = require('./ordering.processor');
const { resolveTagsNames } = require('./tags.processor');

module.exports = {
    addSdkSamples,
    addCurlSamples,
    filterBySpec,
    orderBySpec,
    resolveTagsNames,
};
