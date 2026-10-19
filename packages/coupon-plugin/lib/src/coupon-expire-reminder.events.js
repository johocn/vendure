"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponExpireRemindEvent = void 0;
const core_1 = require("@vendure/core");
/**
 * 券过期提醒事件（coupon-plugin 定时扫描产出，notification-plugin 订阅触达）。
 * 通道选择（站内信全量 + 公众号增强）与 R4 防骚扰（同用户同券同阶段 7 天内最多 1 次）
 * 统一在 notification-plugin 订阅侧处理，coupon-plugin 只负责圈出临期券。
 */
class CouponExpireRemindEvent extends core_1.VendureEvent {
    constructor(ctx, payload) {
        super();
        this.ctx = ctx;
        this.payload = payload;
    }
}
exports.CouponExpireRemindEvent = CouponExpireRemindEvent;
//# sourceMappingURL=coupon-expire-reminder.events.js.map