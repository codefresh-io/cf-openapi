const path = require('path');
const fs = require('fs');
const _ = require('lodash');

function makeUrl(serviceConfig) {
    const { uri, port, protocol } = serviceConfig;
    const _port = port ? `:${port}` : '';
    return `${protocol}://${uri}${_port}`;
}

function findAppRoot(dir = path.dirname(require.main.filename)) {
    return fs.existsSync(path.join(dir, 'package.json'))
        ? dir
        : findAppRoot(path.resolve(dir, '..'));
}

function reduceFiles(files, componentEnding) {
    return _.chain(files)
        .filter(f => f.endsWith(componentEnding))
        .reduce((acc, filename) => {
            const component = path.basename(filename).replace(componentEnding, '');
            acc[component] = require(filename); // eslint-disable-line
            return acc;
        }, {})
        .value();
}


module.exports = {
    makeUrl,
    findAppRoot,
    reduceFiles,
};
