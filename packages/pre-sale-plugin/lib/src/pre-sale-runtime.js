"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPreSaleConnection = setPreSaleConnection;
exports.getPreSaleConnection = getPreSaleConnection;
/**
 * Promotion 条件/动作在结算期同步路径里需要访问 DB（按订单关联的预售活动动态取预售价）。
 * 这里在插件 onApplicationBootstrap 时注入 TransactionalConnection，
 * 供静态构造的 PromotionCondition / PromotionItemAction 内延迟获取。
 */
let connection;
function setPreSaleConnection(conn) {
    connection = conn;
}
function getPreSaleConnection() {
    if (!connection) {
        throw new Error('PreSalePlugin TransactionalConnection not initialized');
    }
    return connection;
}
//# sourceMappingURL=pre-sale-runtime.js.map