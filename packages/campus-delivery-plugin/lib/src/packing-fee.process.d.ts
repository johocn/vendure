import { OrderProcess, OrderService, TransactionalConnection } from '@vendure/core';
export declare function bindPackingFeeDeps(conn: TransactionalConnection, orderService: OrderService): void;
export declare const campusPackingFeeProcess: OrderProcess<any>;
