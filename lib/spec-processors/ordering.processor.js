const _ = require('lodash');

const TAGS_GROUPS_FIELD = 'x-tagGroups';

function orderBySpec(spec) {
    if (_.isEmpty(spec[TAGS_GROUPS_FIELD])) {
        return spec;
    }
    const _spec = _.cloneDeep(spec);

    _spec.paths = _.mapValues(_spec.paths, (resource) => {
        const sortedMethods = _.sortBy(_.keys(resource), (methodName) => {
            switch (methodName) {
                case 'post':
                    return 1;
                case 'get':
                    return 2;
                case 'put':
                    return 3;
                case 'patch':
                    return 4;
                case 'delete':
                    return 5;
                default:
                    return 6;
            }
        });
        return sortedMethods.reduce((acc, name) => {
            acc[name] = resource[name];
            return acc;
        }, {});
    });

    _spec[TAGS_GROUPS_FIELD] = _.map(_spec[TAGS_GROUPS_FIELD], (group) => {
        group.tags = _.sortBy(group.tags);
        return group;
    });
    _spec.tags = _.sortBy(_spec.tags, 'name');
    return _spec;
}

module.exports = { orderBySpec };
