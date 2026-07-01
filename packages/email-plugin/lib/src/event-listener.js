"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailEventListener = void 0;
const event_handler_1 = require("./handler/event-handler");
/**
 * @description
 * An EmailEventListener is used to listen for events and set up a {@link EmailEventHandler} which
 * defines how an email will be generated from this event.
 *
 * @docsCategory core plugins/EmailPlugin
 */
class EmailEventListener {
    constructor(type) {
        this.type = type;
    }
    /**
     * @description
     * Defines the event to listen for.
     */
    on(event) {
        return new event_handler_1.EmailEventHandler(this, event);
    }
}
exports.EmailEventListener = EmailEventListener;
//# sourceMappingURL=event-listener.js.map