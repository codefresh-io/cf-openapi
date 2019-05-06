const _ = require('lodash');

const FILTERS_FIELD_NAME = 'x-filters';

function _intersects(firstList, secondList) {
    return !_.isEmpty(_.intersection(firstList, secondList));
}

function filterBySpec(spec) {
    if (_.isEmpty(spec[FILTERS_FIELD_NAME])) {
        return spec;
    }
    const _spec = _.cloneDeep(spec);

    const filters = _.get(_spec, FILTERS_FIELD_NAME);

    const filterUrlRegexStr = _.chain(filters)
        .filter(f => f.pathRegex && !f.methods && !f.tags)
        .map(f => `(${f.pathRegex})`)
        .join('|')
        .value();
    const filterUrlRegex = new RegExp(_.isEmpty(filterUrlRegexStr) ? '!(.+)' : filterUrlRegexStr);

    const complexFilters = _.chain(filters)
        .filter(f => f.pathRegex && (f.methods || f.tags))
        .map(f => _.mapValues(f, (value, key) => (key === 'pathRegex' ? new RegExp(value) : value)))
        .value();

    const globalTagsFilters = _.chain(filters)
        .filter(f => f.tags && !f.pathRegex && !f.methods)
        .map(f => f.tags)
        .flatten()
        .value();

    const urlsToRemove = [];
    _.forEach(_spec.paths, (resource, path) => {
        if (filterUrlRegex.test(path)) {
            urlsToRemove.push(path);
            return;
        }

        const methodsToRemove = [];
        _.forEach(resource, (method, methodName) => {
            if (_intersects(method.tags, globalTagsFilters)) {
                methodsToRemove.push(methodName);
                return;
            }
            const currentFilters = complexFilters.filter(f => f.pathRegex.test(path));
            currentFilters.forEach((filter) => {
                if (_intersects(method.tags, filter.tags) || _.includes(filter.methods, methodName.toLowerCase())) {
                    methodsToRemove.push(methodName);
                }
            });
        });
        methodsToRemove.forEach((method) => {
            delete resource[method];
        });
    });

    urlsToRemove.forEach((url) => {
        delete _spec.paths[url];
    });

    let notEmptyTags = [];
    delete _spec[FILTERS_FIELD_NAME];
    _.forEach(_spec.paths, (resource, path) => {
        if (_.isEmpty(resource)) {
            delete _spec.paths[path];
            return;
        }
        _.forEach(resource, (method) => {
            notEmptyTags = _.union(notEmptyTags, method.tags);
        });
    });

    _spec.tags = _.filter(_spec.tags, tag => !globalTagsFilters.includes(tag['x-id']) && notEmptyTags.includes(tag['x-id']));
    _spec['x-tagGroups'] = _.map(_spec['x-tagGroups'], (group) => {
        group.tags = _.filter(group.tags, tag => !globalTagsFilters.includes(tag) && notEmptyTags.includes(tag));
        return group;
    });
    return _spec;
}

module.exports = { filterBySpec };
