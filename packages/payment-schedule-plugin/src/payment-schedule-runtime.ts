import { Injector, TransactionalConnection } from '@vendure/core';

/**
 * 静态构造的 OrderProcess onTransitionStart 与通知工具需要在运行期访问 DB/容器。
 * 插件 onApplicationBootstrap 时注入。
 */
let connection: TransactionalConnection | undefined;
let injectorRef: Injector | undefined;

export function setPaymentScheduleRuntime(conn: TransactionalConnection, injector: Injector): void {
    connection = conn;
    injectorRef = injector;
}

export function getPaymentScheduleConnection(): TransactionalConnection {
    if (!connection) {
        throw new Error('PaymentSchedulePlugin TransactionalConnection not initialized');
    }
    return connection;
}

export function getPaymentScheduleInjector(): Injector {
    if (!injectorRef) {
        throw new Error('PaymentSchedulePlugin Injector not initialized');
    }
    return injectorRef;
}

/** 软依赖取容器内 provider：未注册/异常时返回 null */
export function tryGetProvider<T = any>(type: any): T | null {
    try {
        // 本版本 Injector.get 仅收 1 参（内部已传 { strict: false }），语义一致
        return getPaymentScheduleInjector().get(type) as T;
    } catch {
        return null;
    }
}
