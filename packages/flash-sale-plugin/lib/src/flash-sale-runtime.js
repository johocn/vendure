"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFlashSaleConnection = setFlashSaleConnection;
exports.getFlashSaleConnection = getFlashSaleConnection;
/**
 * Promotion 条件/动作在结算期同步路径里需要访问 DB（按订单关联的秒杀活动动态取 flashPrice）。
 * 这里在插件 onApplicationBootstrap 时注入 TransactionalConnection，
 * 供静态构造的 PromotionCondition / PromotionItemAction 内延迟获取（不破坏同步签名的可注入性）。
 */
let connection;
function setFlashSaleConnection(conn) {
    connection = conn;
}
function getFlashSaleConnection() {
    if (!connection) {
        throw new Error('FlashSalePlugin TransactionalConnection not initialized');
    }
    return connection;
}
//# sourceMappingURL=flash-sale-runtime.js.map