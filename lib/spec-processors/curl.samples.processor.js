const _ = require('lodash');
const { formatEnvVar, processBody } = require('./helpers');

function _formatNewLine(str) {
    return _.isEmpty(str) ? '' : ` \\\n    ${str}`;
}

function formatUrl(spec) {
    const pathParams = _.chain(spec.parameters)
        .filter(p => p.in === 'path')
        .map(p => p.name);
    const path = pathParams.reduce((url, param) => url.replace(`{${param}}`, `${formatEnvVar(param)}`), spec.path);
    return `${spec.url}${path}`;
}

function formatMethod(spec) {
    return `-X ${spec.method.toUpperCase()}`;
}

function formatAuth(spec) {
    return _.chain(spec.security)
        .keys()
        .map(name => _.merge(_.get(spec, `securitySchemes.${name}`, {}), { securityName: name }))
        .filter(scheme => scheme.in === 'header')
        .map(scheme => `-H "${scheme.name}: ${formatEnvVar(scheme.securityName)}"`)
        .value()
        .join('\n    ');
}

function formatHeaders(spec) {
    const isJson = _.get(spec, 'requestBody.content.application/json');

    const headers = _.chain(spec.parameters)
        .filter(p => p.in === 'header')
        .map(p => `-H '${p.name}: ${formatEnvVar(p.name)}'`)
        .value();

    if (isJson) {
        headers.unshift("-H 'Content-Type: application/json; charset=utf-8'");
    }
    return headers.join('\n    ');
}

function formatParams(spec) {
    const params = _.chain(spec.parameters)
        .filter(p => p.in === 'query')
        .map(p => `${p.name}=${formatEnvVar(p.name)}`)
        .value();
    return _.isEmpty(params) ? '' : `?${params.join('&')}`;
}

function formatBody(spec) {
    let body = _.get(spec, 'requestBody.content.application/json.schema');
    body = processBody(body);
    body = _.isString(body) ? body : `${JSON.stringify(body)}`;
    body = body.replace(/"\${/g, '${').replace(/\b}"/g, '}');
    body = body.replace(/"'\${/g, '"${').replace(/\b}'"/g, '}"');
    body = _.isEmpty(body) ? '' : `-d ${JSON.stringify(body)}`;
    return body;
}

function generateCurl(spec) {
    const data = [
        formatMethod(spec),
        formatAuth(spec),
        formatHeaders(spec),
        formatBody(spec),
    ]
        .map(str => _formatNewLine(str))
        .filter(str => !_.isEmpty(str));
    const curlStr = `curl ${data.join('')}${_formatNewLine(`"${formatUrl(spec)}${formatParams(spec)}"`)}`;
    return {
        path: spec.path,
        method: spec.method,
        curl: [curlStr],
    };
}

function generateCurlSamples(spec) {
    const url = _.get(spec, 'servers[0].url', 'https://g.codefresh.io/api');
    const securitySchemes = _.get(spec, 'components.securitySchemes', {});
    const security = _.get(spec, 'security', []);
    const paths = _.cloneDeep(spec.paths);
    return _.chain(paths)
        .map((resource, path) => _.map(resource, (method, methodName) => _.merge(method, {
            url: path.startsWith('http') ? '' : url,
            path,
            securitySchemes,
            method: methodName,
            security: security.concat(method.security || []),
        })))
        .flatten()
        .map(method => { // eslint-disable-line
            const res = _.map(method.security, security => _.merge(method, { security })); // eslint-disable-line
            return _.isEmpty(res) ? [method] : res;
        })
        .flatten()
        .map(generateCurl)
        .reduce((acc, obj) => {
            const path = `${obj.path}`;
            const method = `${obj.method}`;
            const res = acc[path] || { path, method, curl: [] };
            const fullPath = `${obj.path}.${obj.method}`;
            res.curl = res.curl.concat(obj.curl);
            acc[fullPath] = res;
            return acc;
        }, {})
        .value();
}

function addCurlSamples(spec) {
    const samples = generateCurlSamples(spec);
    const _spec = _.cloneDeep(spec);
    _.forEach(samples, (sample) => {
        const path = `${sample.method}.x-code-samples`;
        _.set(_spec.paths[sample.path], path, _.get(_spec.paths[sample.path], path, []).concat([{
            lang: 'curl',
            source: sample.curl.join('\n\n'),
        }]));
    });
    return _spec;
}

module.exports = {
    generateCurlSamples,
    addCurlSamples,
};
