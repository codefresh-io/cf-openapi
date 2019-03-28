const _ = require('lodash');

function resolveTagsNames(spec) {
    const _spec = _.cloneDeep(spec);
    const existingNames = new Set();
    const names = _.chain(spec)
        .get('tags', [])
        .filter(t => t['x-id'])
        .reduce((acc, tag) => {
            const id = tag['x-id'];
            while (existingNames.has(tag.name)) {
                tag.name += '.';
            }
            acc[id] = tag.name;
            existingNames.add(tag.name);
            return acc;
        }, {})
        .value();
    _.forEach(_spec['x-tagGroups'], (group) => {
        group.tags = _.map(group.tags, tagId => names[tagId] || tagId);
    });
    _.forEach(_spec.paths, (resource) => {
        _.forEach(resource, (method) => {
            method.tags = _.map(method.tags, tagId => names[tagId] || tagId);
        });
    });
    return _spec;
}

module.exports = { resolveTagsNames };
