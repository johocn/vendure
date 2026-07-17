"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailSendEvent = void 0;
const core_1 = require("@vendure/core");
/**
 * @description
 * This event is fired when an email sending attempt has been made. If the sending was successful,
 * the `success` property will be `true`, and if not, the `error` property will contain the error
 * which occurred.
 *
 * @docsCategory core plugins/EmailPlugin
 * @since 2.2.0
 */
class EmailSendEvent extends core_1.VendureEvent {
    constructor(ctx, details, success, error, metadata) {
        super();
        this.ctx = ctx;
        this.details = details;
        this.success = success;
        this.error = error;
        this.metadata = metadata;
    }
}
exports.EmailSendEvent = EmailSendEvent;
//# sourceMappingURL=email-send-event.js.map