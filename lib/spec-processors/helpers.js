const _ = require('lodash');

function formatEnvVar(str) {
    return `\${${_.snakeCase(str).toUpperCase()}}`;
}

function clearEnvVarFormat(str) {
    return str
        .replace(/'\${/g, '').replace(/\b}'/g, '')
        .replace(/\${/g, '').replace(/\b}/g, '');
}

function wrapForJson(str) {
    return `__${str}__`;
}

function unwrapForJson(str) {
    return str
        .replace(/"__/g, '')
        .replace(/__"/g, '');
}

function processBody(body, name) {
    if (!body) {
        return '';
    }

    if (body.type === 'array') {
        if (_.isEmpty(body.items)) {
            return formatEnvVar(`${name || 'request_body'}_arr`);
        }
        return _.map(body.items, (item) => processBody(item, name));
    }

    if (body.type === 'object') {
        if (_.isEmpty(body.properties)) {
            return formatEnvVar(`${name || 'request_body'}_obj`);
        }
        return _.mapValues(body.properties, processBody);
    }

    if (body.type === 'string') {
        return `'${formatEnvVar(`${name || 'request_body'}_str`)}'`;
    }

    if (body.type === 'boolean') {
        return formatEnvVar(`${name || 'request_body'}_bool`);
    }

    if (['number', 'integer', 'float', 'double'].includes(body.type)) {
        return formatEnvVar(`${name || 'request_body'}_num`);
    }

    return formatEnvVar(`${name || 'request_body'}_obj`);
}

module.exports = {
    formatEnvVar,
    processBody,
    clearEnvVarFormat,
    wrapForJson,
    unwrapForJson,
};
