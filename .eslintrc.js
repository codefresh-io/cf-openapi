module.exports = {
    'plugins': [
        'jest'
    ],
    'extends': 'airbnb-base',
    'rules': {
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'no-underscore-dangle': [0],
        'max-len': ['error', {
            'code': 140,
            'ignoreComments': true
        }],
        'no-console': 0,
        'no-param-reassign': 0,
        'class-methods-use-this': 0
    },
    'env': {
        'jest': true,
    }
};
