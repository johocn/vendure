import { Injector, TransactionalConnection } from '@vendure/core';
export declare function setPaymentScheduleRuntime(conn: TransactionalConnection, injector: Injector): void;
export declare function getPaymentScheduleConnection(): TransactionalConnection;
export declare function getPaymentScheduleInjector(): Injector;
/** 软依赖取容器内 provider：未注册/异常时返回 null */
export declare function tryGetProvider<T = any>(type: any): T | null;
