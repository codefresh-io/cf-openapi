const _ = require('lodash');
const dereference = require('json-schema-deref-sync');

const { addCurlSamples } = require('../spec-processors/curl.samples.processor');
const { addSdkSamples } = require('../spec-processors/sdk.samples.processor');
const { filterBySpec } = require('../spec-processors/filtering.processor');
const { orderBySpec } = require('../spec-processors/ordering.processor');
const { resolveTagsNames } = require('../spec-processors/tags.processor');

const Base = require('./base');

const SPEC_KEYS = ['serviceId', 'paths', 'servers', 'tags', 'components', 'security', 'x-internal-services'];

const SPEC_TEMPLATE = {
    openapi: '3.0.0',
    info: {
        title: 'All services spec',
        version: '1.0.0',
    },
    security: [],
    'x-tagGroups': [],
    tags: [],
    paths: {},
    components: {},
};

class Processor extends Base {
    /**
     * currently optional
     * */
    init(config) {
        super.init(config);
        return this;
    }

    // todo : add tests
    aggregateDependenciesSpec(specs) {
        return _.chain(specs)
            .cloneDeep()
            .mapValues((spec, serviceId) => _.merge(spec, { serviceId }))
            .values()
            .map((spec) => {
                const { serviceId } = spec;
                const url = _.get(spec, 'servers[0].url', `{${serviceId}}`);

                this._resolveComponentsCollisions(spec, serviceId);
                this._resolveSpecTagsCollisions(spec, serviceId);

                const security = spec.security || [];
                spec.paths = _.reduce(spec.paths, (acc, resource, path) => {
                    const _path = `${url}${path}`;
                    acc[_path] = _.mapValues(resource, (method) => {
                        this._resolveOperationIdCollisions(method, serviceId);
                        this._resolveMethodTagsCollisions(method, serviceId);
                        this._localizeSpecGlobalSecurity(method, security);
                        return method;
                    });
                    return acc;
                }, {});


                return _.pick(spec, SPEC_KEYS);
            })
            .reduce(this._mergeSpecs, _.cloneDeep(SPEC_TEMPLATE))
            .value();
    }

    postprocess(spec, options = {}) {
        const { isRaw, disableFilter } = options;

        const specProcessors = [
            disableFilter ? _.identity : filterBySpec,
            dereference,
            addCurlSamples,
            addSdkSamples,
            resolveTagsNames,
            orderBySpec,
        ];


        return isRaw ? spec : specProcessors.reduce((_spec, processor) => processor(_spec), spec);
    }

    _mergeSpecs(finalSpec, spec) {
        finalSpec.tags = finalSpec.tags.concat(spec.tags || []); //
        finalSpec['x-tagGroups'].push({
            name: _.startCase(spec.serviceId),
            tags: _.map(spec.tags, tag => tag['x-id']),
            'x-internal-services': _.get(spec, 'x-internal-services', []),
        });
        finalSpec.paths = _.defaults(finalSpec.paths, spec.paths);
        finalSpec.components = _.defaultsDeep(finalSpec.components, spec.components);
        return finalSpec;
    }

    _localizeSpecGlobalSecurity(method, security) {
        if (_.isEmpty(method.security)) {
            method.security = security;
        }
    }

    _resolveOperationIdCollisions(method, serviceId) {
        if (method.operationId) {
            method.operationId = `${serviceId}-${method.operationId}`;
        }
    }

    _resolveMethodTagsCollisions(method, serviceId) {
        method.tags = _.map(method.tags, tag => `${serviceId}:${tag}`);
    }

    _resolveSpecTagsCollisions(spec, serviceId) {
        _.forEach(spec.tags, (tag) => {
            tag['x-id'] = `${serviceId}:${tag['x-id']}`;
        });
    }

    _resolveComponentsCollisions(spec, serviceId) {
        let pathsStr = JSON.stringify(spec.paths);
        let componentsStr = JSON.stringify(spec.components || {});
        let globalSecurityStr = JSON.stringify(spec.security || []);

        let allSecurity = _.mapValues(spec.paths, p => _.mapValues(p, m => m.security || []));
        let allSecurityStr = JSON.stringify(allSecurity);

        _.forEach(spec.components, (category, categoryName) => {
            _.forEach(category, (component, componentName) => {
                const fixedComponentName = `${serviceId}-${componentName}`;

                const refStrRegex = new RegExp(`#/components/${categoryName}/${componentName}`, 'g');
                const componentNameRegex = new RegExp(`"${componentName}":`, 'g');
                const securityNameRegex = new RegExp(`"${componentName}":\\[]`, 'g');

                const refReplacement = `#/components/${categoryName}/${fixedComponentName}`;
                const componentReplacement = `"${fixedComponentName}":`;
                const securityNameReplacement = `"${fixedComponentName}":[]`;

                pathsStr = pathsStr.replace(refStrRegex, refReplacement);
                componentsStr = componentsStr.replace(refStrRegex, refReplacement).replace(componentNameRegex, componentReplacement);
                if (categoryName === 'securitySchemes') {
                    globalSecurityStr = globalSecurityStr.replace(securityNameRegex, securityNameReplacement);
                    allSecurityStr = allSecurityStr.replace(securityNameRegex, securityNameReplacement);
                }
            });
        });

        spec.paths = JSON.parse(pathsStr);
        spec.components = JSON.parse(componentsStr);
        spec.security = JSON.parse(globalSecurityStr);
        allSecurity = JSON.parse(allSecurityStr);
        _.forEach(allSecurity, (resource, path) => _.forEach(resource, (security, method) => {
            _.set(spec, `paths.${path}.${method}.security`, security);
        }));
    }
}

module.exports = new Processor();
