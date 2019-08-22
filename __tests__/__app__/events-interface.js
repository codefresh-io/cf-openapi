class EventsInterface {
    constructor() {
        this.callback = null;
        this.subscribeCalls = 0;
        this.subscribeCacheEvictCalls = 0;
        this.subscribeCacheEvictHandler = null;
        this.publishCalls = 0;
        this.subscribe = this.subscribe.bind(this);
        this.publish = this.publish.bind(this);
        this.subscribeCacheEvictInterface = this.subscribeCacheEvictInterface.bind(this);
    }

    subscribe(callback) {
        this.subscribeCalls = this.subscribeCalls + 1;
        this.callback = callback;
    }

    publish(data) {
        this.publishCalls = this.publishCalls + 1;
        return this.callback(data);
    }

    // eslint-disable-next-line no-unused-vars
    subscribeCacheEvictInterface(event, handler, options) {
        this.subscribeCacheEvictCalls = this.subscribeCacheEvictCalls + 1;
        this.subscribeCacheEvictHandler = handler;
    }
}

module.exports = new EventsInterface();
