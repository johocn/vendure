import { Injector, TransactionalConnection } from '@vendure/core';

/**
 * 运行时依赖注入点：
 * - connection：Promotion 条件/动作在结算期同步路径里访问 DB
 * - injector：软依赖桥（payment-schedule-bridge）经 tryGet 获取跨插件服务
 */
let connection: TransactionalConnection | undefined;
let injector: Injector | undefined;

export function setPreSaleConnection(conn: TransactionalConnection): void {
    connection = conn;
}

export function getPreSaleConnection(): TransactionalConnection {
    if (!connection) {
        throw new Error('PreSalePlugin TransactionalConnection not initialized');
    }
    return connection;
}

export function setPreSaleInjector(inj: Injector): void {
    injector = inj;
}

export function getPreSaleInjector(): Injector {
    if (!injector) {
        throw new Error('PreSalePlugin Injector not initialized');
    }
    return injector;
}
