import { RequestContext, TransactionalConnection } from '@vendure/core';
export interface StockItem {
    materialId: number;
    qty: number;
}
export interface StockShortage {
    materialId: number;
    code: string;
    required: number;
    available: number;
}
/**
 * 素材库存（偏差 3：DB 原子 UPDATE 替代 Redis 锁）：
 * `stock = stock - qty WHERE id = ? AND stock >= qty` 单语句原子，affected=0 即缺口。
 * deduct 全有或全无：任一缺口先回补已扣行，再返回缺口明细（不抛错，由调用方转 UserInputError）。
 * 库存归属：BOM.materialId 指向合并视图行——未复制的平台行扣平台库存，租户复制行扣租户库存（规格 §4.3）。
 * ctx 可传 undefined（事件订阅者等无 ctx 场景，走默认连接）。
 */
export declare class DiyStockService {
    private connection;
    constructor(connection: TransactionalConnection);
    deduct(ctx: RequestContext | undefined, items: StockItem[]): Promise<StockShortage[]>;
    restock(ctx: RequestContext | undefined, items: StockItem[]): Promise<void>;
}
