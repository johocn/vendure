"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatMessageEvent = void 0;
const core_1 = require("@vendure/core");
class WechatMessageEvent extends core_1.VendureEvent {
    constructor(message) {
        super();
        this.message = message;
    }
}
exports.WechatMessageEvent = WechatMessageEvent;
//# sourceMappingURL=wechat-message.events.js.map