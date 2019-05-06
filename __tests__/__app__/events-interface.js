class EventsInterface {
    constructor() {
        this.callback = null;
        this.subscribeCalls = 0;
        this.publishCalls = 0;
        this.subscribe = this.subscribe.bind(this);
        this.publish = this.publish.bind(this);
    }

    subscribe(callback) {
        this.subscribeCalls = this.subscribeCalls + 1;
        this.callback = callback;
    }

    publish(data) {
        this.publishCalls = this.publishCalls + 1;
        return this.callback(data);
    }
}

module.exports = new EventsInterface();
