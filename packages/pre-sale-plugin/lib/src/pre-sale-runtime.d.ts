import { Injector, TransactionalConnection } from '@vendure/core';
export declare function setPreSaleConnection(conn: TransactionalConnection): void;
export declare function getPreSaleConnection(): TransactionalConnection;
export declare function setPreSaleInjector(inj: Injector): void;
export declare function getPreSaleInjector(): Injector;
