"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPreSaleConnection = setPreSaleConnection;
exports.getPreSaleConnection = getPreSaleConnection;
exports.setPreSaleInjector = setPreSaleInjector;
exports.getPreSaleInjector = getPreSaleInjector;
/**
 * 运行时依赖注入点：
 * - connection：Promotion 条件/动作在结算期同步路径里访问 DB
 * - injector：软依赖桥（payment-schedule-bridge）经 tryGet 获取跨插件服务
 */
let connection;
let injector;
function setPreSaleConnection(conn) {
    connection = conn;
}
function getPreSaleConnection() {
    if (!connection) {
        throw new Error('PreSalePlugin TransactionalConnection not initialized');
    }
    return connection;
}
function setPreSaleInjector(inj) {
    injector = inj;
}
function getPreSaleInjector() {
    if (!injector) {
        throw new Error('PreSalePlugin Injector not initialized');
    }
    return injector;
}
//# sourceMappingURL=pre-sale-runtime.js.map