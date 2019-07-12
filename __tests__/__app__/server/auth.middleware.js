class AuthMiddleware {
    isAuthenticated(req, res, next) {
        console.log('auth middleware');
        next();
    }
}

module.exports = new AuthMiddleware();
