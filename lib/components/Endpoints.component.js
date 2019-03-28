const _ = require('lodash');

const Base = require('./base');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const defaults = require('../../defaults');


class Endpoints extends Base {
    constructor() {
        super();
        this.adminSpecMiddleware = [];
        this.specMiddleware = [];
    }

    init(config) {
        if (this.isEnabled) return this;
        super.init(config);
        this.components.specProvider.init(config);
        this.components.store.init(config);
        this.components.processor.init(config);

        const {
            openapi: {
                spec,
                adminSpec,
            } = {},
        } = config;
        this.spec = spec;
        this.adminSpec = adminSpec;
        return this;
    }

    register(app) {
        console.log('endpoints.register');
        this.registerSpecEndpoint(app);
        this.registerAdminSpecEndpoint(app);
        this.registerRedocEndpoints(app);
    }

    registerSpecEndpoint(app) {
        console.log('registerSpecEndpoint');
        if (this.spec === false) {
            console.log('Spec endpoint is disabled');
            return;
        }

        const spec = this.components.specProvider.get();
        if (!spec) {
            console.log('Spec endpoint is not registered - openapi.json does not exist');
            return;
        }

        const path = _.get(this, 'spec.specPath', defaults.SPEC_PATH);
        const middlewares = this.specMiddleware;

        app.get(path, ...middlewares, (req, res) => {
            res.send(this.components.processor.postprocess(this.components.specProvider.get(), {
                isRaw: _.has(req, 'query.raw'),
                disableFilter: _.has(req, 'query.disableFilter'),
            }));
        });
    }

    registerAdminSpecEndpoint(app) {
        console.log('registerAdminSpecEndpoint');
        if (this.adminSpec === false) {
            return;
        }

        const path = _.get(this, 'adminSpec.specPath', defaults.ADMIN_SPEC_PATH);
        const middlewares = this.adminSpecMiddleware;

        app.get(path, ...middlewares, (req, res) => {
            res.send(this.components.processor.aggregateAdminSpec(this.components.store.listServiceSpecs()));
        });
    }

    registerRedocEndpoints(app) {
        if (this.spec === false || this.adminSpec === false) {
            console.log('Neither spec nor admin spec endpoints is enabled');
            return;
        }

        const specPath = _.get(this, 'config.spec.specPath', defaults.SPEC_PATH);
        const adminSpecPath = _.get(this, 'config.adminSpec.specPath', defaults.ADMIN_SPEC_PATH);

        const specRedocPath = _.get(this, 'config.spec.redocPath', defaults.REDOC_PATH);
        const adminRedocPath = _.get(this, 'config.adminSpec.redocPath', defaults.ADMIN_REDOC_PATH);

        handleRedocScript(app);

        if (this.spec !== false) {
            handleRedocIndex(app, specPath, specRedocPath);
        }
        if (this.adminSpec !== false) {
            handleRedocIndex(app, adminSpecPath, adminRedocPath);
        }
    }

    addSpecMiddleware(middleware) {
        this.specMiddleware.push(middleware);
    }

    addAdminSpecMiddleware(middleware) {
        this.adminSpecMiddleware.push(middleware);
    }
}

module.exports = new Endpoints();
