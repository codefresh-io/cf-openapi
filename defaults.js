module.exports = {
    SPEC_FILENAME: './openapi.json',
    SPEC_PATH: '/api/openapi.json',
    SCOPES_PATH: '/api/scopes',
    ADMIN_SPEC_PATH: '/api/admin/openapi.json',
    REDOC_PATH: '/api',
    ADMIN_REDOC_PATH: '/api/admin',
    REDOC_STATIC_PATH: '/api/static/redoc.standalone.min.js',
    DEPENDENCIES_FETCH_RETRY_TIMEOUT: process.env.DEPENDENCIES_FETCH_RETRY_TIMEOUT || 5000,
};
