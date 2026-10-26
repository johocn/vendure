import { OrderProcess, OrderService, TransactionalConnection } from '@vendure/core';
export declare function bindAddonFeeDeps(conn: TransactionalConnection, orderService: OrderService): void;
/** surcharge 展示名（C 端按 sku 本地化，后台/小票直接用该文案） */
export declare const ADDON_FEE_LABEL = "\u52A0\u6599\u8D39";
export declare const campusAddonFeeProcess: OrderProcess<any>;
