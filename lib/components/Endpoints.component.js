const _ = require('lodash');

const Base = require('./base');
const processor = require('./Processor.component');
const store = require('./Store.component');

const { handleRedocIndex, handleRedocScript } = require('../redoc');
const defaults = require('../../defaults');


class Endpoints extends Base{
    constructor() {
        super();
        this.adminSpecMiddleware = [];
        this.specMiddleware = [];
    }

    init(config) {
        if (this.isEnabled) return;
        super.init(config);
        store.init(config);

        const {
            openapi: {
                spec,
                adminSpec,
            } = {}
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
        const config = this.spec;
        if (!config) {
            return;
        }

        const path = config.specPath || defaults.SPEC_PATH;
        const spec = store.getExposedSpec(); // catch value inside closure
        const middlewares = this.specMiddleware;

        app.get(path, ...middlewares, (req, res) => {
            res.send(processor.postprocess(spec, {
                isRaw: _.has(req, 'query.raw'),
                disableFilter: _.has(req, 'query.disableFilter')
            }))
        });
    }

    registerAdminSpecEndpoint(app) {
        console.log('registerAdminSpecEndpoint');
        const config = this.adminSpec;
        if (!config) {
            return;
        }

        const path = config.specPath || defaults.ADMIN_SPEC_PATH;
        const middlewares = this.adminSpecMiddleware;

        app.get(path, ...middlewares, (req, res) => res.send(processor.aggregateAdminSpec(store.listSpecs())));
    }

    registerRedocEndpoints(app) {
        const specPath = _.get(this, 'config.spec.specPath', defaults.SPEC_PATH);
        const adminSpecPath = _.get(this, 'config.adminSpec.specPath', defaults.ADMIN_SPEC_PATH);

        const specRedocPath = _.get(this, 'config.spec.redocPath');
        const adminSpecRedocPath = _.get(this, 'config.adminSpec.redocPath');

        if (!specRedocPath && !adminSpecRedocPath)
            return;

        handleRedocScript(app);

        if (specRedocPath) {
            handleRedocIndex(app, specPath, specRedocPath)
        }
        if (adminSpecRedocPath) {
            handleRedocIndex(app, adminSpecPath, adminSpecRedocPath)
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
