
module.exports = {
    root: __dirname,
    port: process.env.PORT || 9999,

    services: {
        buda: {
            name: 'buda',
            port: 9001,
            uri: 'buda.pest',
            protocol: 'http',
        },

        pest: {
            name: 'pest',
            uri: 'buda.pest',
            protocol: 'http',
        },
    },
};
