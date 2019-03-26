function makeUrl(serviceConfig) {
    const { uri, port, protocol } = serviceConfig;
    const _port = port ? `:${port}` : '';
    return `${protocol}://${uri}${_port}`;
}

module.exports = {
    makeUrl,
};
