"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPaymentScheduleRuntime = setPaymentScheduleRuntime;
exports.getPaymentScheduleConnection = getPaymentScheduleConnection;
exports.getPaymentScheduleInjector = getPaymentScheduleInjector;
exports.tryGetProvider = tryGetProvider;
/**
 * 静态构造的 OrderProcess onTransitionStart 与通知工具需要在运行期访问 DB/容器。
 * 插件 onApplicationBootstrap 时注入。
 */
let connection;
let injectorRef;
function setPaymentScheduleRuntime(conn, injector) {
    connection = conn;
    injectorRef = injector;
}
function getPaymentScheduleConnection() {
    if (!connection) {
        throw new Error('PaymentSchedulePlugin TransactionalConnection not initialized');
    }
    return connection;
}
function getPaymentScheduleInjector() {
    if (!injectorRef) {
        throw new Error('PaymentSchedulePlugin Injector not initialized');
    }
    return injectorRef;
}
/** 软依赖取容器内 provider：未注册/异常时返回 null */
function tryGetProvider(type) {
    try {
        // 本版本 Injector.get 仅收 1 参（内部已传 { strict: false }），语义一致
        return getPaymentScheduleInjector().get(type);
    }
    catch (_a) {
        return null;
    }
}
