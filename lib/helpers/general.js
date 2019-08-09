const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
};

const SCOPE_ACTIONS = {
    write: 'write',
    read: 'read',
};

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

function resolveScopeFromAction(action) {
    switch (action) {
        case ACTIONS.READ:
            return SCOPE_ACTIONS.read;
        case ACTIONS.CREATE:
        case ACTIONS.UPDATE:
        case ACTIONS.DELETE:
            return SCOPE_ACTIONS.write;
        default:
            return action;
    }
}

function resolveActionFromHttpMethod(httpMethod) {
    switch (httpMethod) {
        case 'post':
            return ACTIONS.CREATE;
        case 'get':
        case 'head':
        case 'options':
            return ACTIONS.READ;
        case 'put':
            return ACTIONS.UPDATE;
        case 'patch':
            return ACTIONS.UPDATE;
        case 'delete':
            return ACTIONS.DELETE;
        default:
            return httpMethod.toLowerCase();
    }
}

function resolveResourceNameFromUrl(urlPath) {
    return _.chain(urlPath)
        .replace('/', '')
        .split('/')
        .first()
        .value();
}

function resolveComponentPath(metaPath) {
    const arr = metaPath.split('.');
    const namespace = _.slice(arr, 0, -1).join('.');
    const operation = _.last(arr);
    return [namespace, operation];
}

function resolveComponent(collector, componentPath) {
    const [namespace, method] = resolveComponentPath(componentPath);
    const component = collector[namespace];
    const componentMethod = component[method];
    return _.isFunction(componentMethod) ? componentMethod.bind(component) : componentMethod;
}

function reduceParams(params, type) {
    return _.chain(params)
        .filter(p => p.in === type)
        .reduce((acc, p) => _.merge(acc, { [p.name]: p }), {})
        .value();
}

function isTextContentType(contentType) {
    return [
        /text\//,
        /application\/json/,
        /application\/x\-javascript/,
        /application\/html/,
        /application\/xml/,
    ].some(regex => regex.test(contentType));
}

module.exports = {
    makeUrl,
    findAppRoot,
    reduceFiles,
    resolveScopeFromAction,
    resolveActionFromHttpMethod,
    resolveResourceNameFromUrl,
    resolveComponent,
    resolveComponentPath,
    reduceParams,
    isTextContentType,
};
