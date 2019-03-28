const _ = require('lodash');

function sdkValidator(openapi) {
    const set = new Set();
    const duplicatedSdkInterface = [];
    _.forEach(openapi.paths, (resource) => {
        _.forEach(resource, (method) => {
            const sdkInterface = method['x-sdk-interface'];
            if (!sdkInterface) {
                return;
            }
            if (set.has(sdkInterface)) {
                duplicatedSdkInterface.push(sdkInterface);
            }
            set.add(sdkInterface);
        });
    });

    if (!_.isEmpty(duplicatedSdkInterface)) {
        const result = _.chain(duplicatedSdkInterface)
            .uniq()
            .map(s => `\n\t - "${s}"`)
            .join()
            .value();
        throw new Error(`Validation error: duplicated x-sdk-interface fields:${result}`);
    }
}

module.exports = sdkValidator;
