module.exports = {
    SPEC_FILENAME: './openapi.json',
    SPEC_ENDPOINT_PATH: '/api/openapi.json',
    SCOPES_ENDPOINT_PATH: '/api/scopes',
    ABAC_ENDPOINT_PATH: '/api/abac/resources',
    ADMIN_SPEC_ENDPOINT_PATH: '/api/admin/openapi.json',
    REDOC_ENDPOINT_PATH: '/api',
    ADMIN_REDOC_ENDPOINT_PATH: '/api/admin',
    REDOC_STATIC_PATH: '/api/static/redoc.standalone.min.js',
    DEPENDENCIES_FETCH_RETRY_TIMEOUT: process.env.DEPENDENCIES_FETCH_RETRY_TIMEOUT || 5000,
};
