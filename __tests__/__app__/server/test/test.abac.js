module.exports = () => {
    console.log('abac factory');
    return (req, res, next) => {
        console.log('abac middleware');
        next();
    };
};
