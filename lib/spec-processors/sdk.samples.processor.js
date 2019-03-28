const _ = require('lodash');
const {
    processBody, clearEnvVarFormat, wrapForJson, unwrapForJson,
} = require('./helpers');

function isObjectFormat(str) {
    return /.+_obj$/i.test(str);
}
function isArrayFormat(str) {
    return /.+_arr$/i.test(str);
}
function isStringFormat(str) {
    return /.+_str$/i.test(str);
}

function postProcessBody(body) {
    if (_.isArray(body)) {
        return _.map(body, postProcessBody);
    }
    if (_.isObject(body)) {
        return _.mapValues(body, postProcessBody);
    }
    if (_.isString(body)) {
        const cleanValue = clearEnvVarFormat(body);
        if (isObjectFormat(cleanValue)) {
            return wrapForJson(`{ ...${cleanValue} }`);
        }
        if (isArrayFormat(cleanValue)) {
            return wrapForJson(`...${cleanValue}`);
        }
        if (isStringFormat(cleanValue)) {
            return wrapForJson(`\`\${${cleanValue}}\``);
        }
        return wrapForJson(cleanValue);
    }
    return wrapForJson(body);
}

function formatParams(method) {
    let params = method.parameters.map(p => p.name);

    let joiner = ', ';
    let preSpace = ' ';
    let postSpace = ' ';
    if (params.length > 3) {
        joiner = ',\n    ';
        preSpace = '\n    ';
        postSpace = '\n';
    }
    params = params.length ? `{${preSpace}${params.join(joiner).replace(/, $/, '')}${postSpace}}` : '';
    return params;
}

function formatBody(method) {
    let body = processBody(_.get(method, 'requestBody.content.application/json.schema'));
    body = postProcessBody(body);
    body = _.isEmpty(body) ? '' : JSON.stringify(body, null, '    ');
    body = unwrapForJson(body).replace(/"/g, '');
    return body;
}

function formatAll(params, body) {
    if (!_.isEmpty(params) && !_.isEmpty(body)) {
        return `${params}, ${body}`;
    }
    return `${params}${body}`;
}

function addSdkSamples(spec) {
    const _spec = _.cloneDeep(spec);
    _.forEach(_spec.paths, (resource) => {
        _.forEach(resource, (method) => {
            if (!method.parameters) {
                method.parameters = [];
            }

            const params = formatParams(method);
            const body = formatBody(method);
            const all = formatAll(params, body);

            let codeSamples = method['x-code-samples'];
            if (!codeSamples) {
                codeSamples = [];
                method['x-code-samples'] = codeSamples;
            }

            codeSamples.push({
                lang: 'node.js',
                source: `sdk.${method['x-sdk-interface']}(${all})`,
            });
        });
    });
    return _spec;
}

module.exports = { addSdkSamples };
