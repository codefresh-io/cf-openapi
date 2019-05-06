const path = require('path');
const fs = require('fs');
const _ = require('lodash');

function makeUrl(serviceConfig) {
    const { uri, port, protocol } = serviceConfig;
    const _port = port ? `:${port}` : '';
    return `${protocol}://${uri}${_port}`;
}

function findAppRoot(dir = path.dirname(require.main.filename)) {
    return !_.includes(dir, 'node_modules') && fs.existsSync(path.join(dir, 'package.json'))
        ? dir
        : findAppRoot(path.resolve(dir, '..'));
}

function reduceFiles(files, componentEnding) {
    return _.chain(files)
        .filter(f => f.endsWith(componentEnding))
        .reduce((acc, filename) => {
            const namespace = path.basename(filename).replace(componentEnding, '');
            const component = require(filename); // eslint-disable-line
            return _.merge(acc, { [namespace]: component });
        }, {})
        .value();
}


module.exports = {
    makeUrl,
    findAppRoot,
    reduceFiles,
};
