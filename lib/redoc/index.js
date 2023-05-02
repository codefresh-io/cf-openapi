const fs = require('fs');
const path = require('path');

const SPEC_PATTERN = '{{SPEC_URL}}';

const html = fs.readFileSync(path.resolve(__dirname, './redoc.template.html'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, './redoc.standalone.min.js'), 'utf8');

const defaults = require('../../defaults');


module.exports = {
    handleRedocIndex: (app, specPath, redocPath, middleware = []) => {
        app.get(redocPath, ...middleware, (req, res) => res.header('Content-Type', 'text/html').send(html.replace(SPEC_PATTERN, specPath)));
    },
    handleRedocScript: app => app.get(defaults.REDOC_STATIC_PATH, (req, res) => res.header('Content-Type', 'text/javascript').send(js)),
};
