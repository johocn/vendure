import { RequestContext, TransactionalConnection } from '@vendure/core';
import { Connection } from 'typeorm';
import { SyncMembersResult, SyncProductsResult } from '../types';
/**
 * 商品/会员增量同步服务：
 * - syncProducts: 按 ProductVariant.updatedAt > since 增量查询，按 Channel 隔离
 * - syncMembers: 按 Customer.updatedAt > since 增量查询，按 Channel 隔离
 *
 * cursor = 当前批次最后一条记录的 updatedAt，前端下次同步以该 cursor 作为 since。
 * 按 updatedAt ASC 排序保证 cursor 单调推进。
 *
 * 关键实现细节（Vendure 3.6.4）：
 * 1. ProductVariant.price/priceWithTax 是 Calculated 属性，依赖运行时注入的 listPrice/taxRateApplied。
 *    直接用 repository 查询时这些属性为 undefined，需从 productVariantPrices 关系取 listPrice。
 *    测试环境 taxRate=0%，price=priceWithTax=listPrice。
 * 2. ProductVariant.name 是 LocaleString，从 translations[0].name 取。
 * 3. Customer.customFields 是 embedded entity，memberLevel/points 由 member-level-plugin 注入。
 *    用 optional chaining + 默认值兜底，未注册该插件时返回 0。
 */
export declare class IncrementalSyncService {
    private connection;
    private transactionalConnection;
    constructor(connection: Connection, transactionalConnection: TransactionalConnection);
    syncProducts(ctx: RequestContext, since: Date, limit: number): Promise<SyncProductsResult>;
    syncMembers(ctx: RequestContext, since: Date, limit: number): Promise<SyncMembersResult>;
}
