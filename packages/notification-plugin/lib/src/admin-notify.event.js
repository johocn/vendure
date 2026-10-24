"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminNotifyEvent = void 0;
const core_1 = require("@vendure/core");
/**
 * 管理侧通知事件（站内信之外的外发钩子）。
 * 由 notification-plugin 在 admin 场景发布，业务插件（如 campus-delivery）订阅后决定是否推到外部群（飞书等）。
 * 只携带已渲染文案与最小定位信息，订阅方自行决定渠道与格式。
 */
class AdminNotifyEvent extends core_1.VendureEvent {
    constructor(ctx, scene, title, content, orderId, orderCode, shopId, link) {
        super();
        this.ctx = ctx;
        this.scene = scene;
        this.title = title;
        this.content = content;
        this.orderId = orderId;
        this.orderCode = orderCode;
        this.shopId = shopId;
        this.link = link;
    }
}
exports.AdminNotifyEvent = AdminNotifyEvent;
//# sourceMappingURL=admin-notify.event.js.map