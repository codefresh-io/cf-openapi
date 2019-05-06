
module.exports = {
    root: __dirname,
    port: process.env.PORT || 9999,

    services: {
        buda: {
            name: 'buda',
            uri: 'buda.pest',
            protocol: 'http',
        },

        pest: {
            name: 'pest',
            port: 9001,
            uri: 'buda.pest',
            protocol: 'http',
        },
    },
};
