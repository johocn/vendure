"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCouponConnection = setCouponConnection;
exports.getCouponConnection = getCouponConnection;
/**
 * Promotion 条件/动作在结算期同步路径里需要访问 DB。
 * 这里在插件 onApplicationBootstrap 时注入 TransactionalConnection，
 * 供静态构造的 PromotionCondition / PromotionAction 内延迟获取（不破坏同步签名的可注入性）。
 */
let connection;
function setCouponConnection(conn) {
    connection = conn;
}
function getCouponConnection() {
    if (!connection) {
        throw new Error('CouponPlugin TransactionalConnection not initialized');
    }
    return connection;
}
//# sourceMappingURL=coupon-runtime.js.map