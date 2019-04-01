const path = require('path');
const fs = require('fs');

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
module.exports = {
    makeUrl,
    findAppRoot,
};
