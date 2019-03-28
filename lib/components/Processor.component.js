const _ = require('lodash');

const { addCurlSamples } = require('../spec-processors/curl.samples.processor');
const { addSdkSamples } = require('../spec-processors/sdk.samples.processor');
const { filterBySpec } = require('../spec-processors/filtering.processor');
const { orderBySpec } = require('../spec-processors/ordering.processor');
const { resolveTagsNames } = require('../spec-processors/tags.processor');

const Base = require('./base');

const SPEC_KEYS = ['serviceId', 'paths', 'servers', 'tags', 'components', 'security'];

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

    aggregateAdminSpec(specs) {
        const finalSpec = _.chain(specs)
            .cloneDeep()
            .mapValues((spec, serviceId) => _.merge(spec, { serviceId }))
            .values()
            .map((spec) => {
                const { serviceId } = spec;
                const url = _.get(spec, 'servers[0].url', `{${serviceId}}`);
                const security = spec.security || [];

                this._resolveSpecTagsCollisions(spec, serviceId);
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

                this._resolveComponentsCollisions(spec, serviceId);

                return _.pick(spec, SPEC_KEYS);
            })
            .reduce(this._mergeSpecs, _.cloneDeep(SPEC_TEMPLATE))
            .value();
        return resolveTagsNames(finalSpec);
    }

    postprocess(spec, options = {}) {
        const { isRaw, disableFilter } = options;

        const specProcessors = [
            disableFilter ? _.identity : filterBySpec,
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
            tag['x-id'] = `${serviceId}:${tag['x-id']}}`;
        });
    }

    _resolveComponentsCollisions(spec, serviceId) {
        let pathsStr = JSON.stringify(spec.paths);
        let componentsStr = JSON.stringify(spec.components || {});

        _.forEach(spec.components, (category, categoryName) => {
            _.forEach(category, (component, componentName) => {
                const fixedComponentName = `${serviceId}-${componentName}`;

                const refStrRegex = new RegExp(`#/components/${categoryName}/${componentName}`, 'g');
                const componentNameRegex = new RegExp(`"${componentName}":`, 'g');

                const refReplacement = `#/components/${categoryName}/${fixedComponentName}`;
                const componentReplacement = `"${fixedComponentName}":`;

                pathsStr = pathsStr.replace(refStrRegex, refReplacement);
                componentsStr = componentsStr.replace(refStrRegex, refReplacement).replace(componentNameRegex, componentReplacement);
            });
        });

        spec.paths = JSON.parse(pathsStr);
        spec.components = JSON.parse(componentsStr);
    }
}

module.exports = new Processor();
