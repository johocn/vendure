import { JobQueueService, TransactionalConnection } from '@vendure/core';
import { EntityManager } from 'typeorm';
import { MeiliService } from './meili.service';
import { KbDocument, MeiliPluginOptions } from './types';
export interface MeiliReindexJobData {
    productId?: string;
    all?: boolean;
}
export declare class ProductSyncService {
    private opts;
    private meili;
    private jobQueueService;
    private connection;
    private queue;
    constructor(opts: MeiliPluginOptions, meili: MeiliService, jobQueueService: JobQueueService, connection: TransactionalConnection);
    /** 照 order-timeout-plugin 模式：由 plugin.onApplicationBootstrap 调用 */
    initQueue(): Promise<void>;
    /** 单品或全量入队；Meili 不可用导致的 job 失败由 retries 兜底重试 */
    enqueue(productIds?: string[]): Promise<void>;
    syncAll(): Promise<void>;
    /**
     * 全量投影：分块查 Product（防大表）→ 组装投影 → toProductDocuments → 按 locale 500 条/批 upsert
     */
    projectAll(em: EntityManager, locales: string[], urlBase: string): Promise<Map<string, KbDocument[]>>;
    /**
     * 单品同步：published → 各语言索引 upsert；draft/disabled → deleteDocuments；
     * 产品已不存在时也做删除（变体/商品删除事件兜底清理）
     */
    syncOne(productId: string): Promise<void>;
    /** 从所有语言索引删除该商品文档（ProductEvent deleted 直连清理入口） */
    removeProduct(productId: string): Promise<void>;
    private urlBase;
    private upsertInBatches;
    private toProjection;
    /** channelId：第一个非默认渠道 id（默认渠道 code '__default_channel__'）；全无则回退默认渠道 '1' */
    private resolveChannelId;
    /**
     * 取价照 vcash-pos-plugin 口径：ProductVariant.price 是 @Calculated 字段（依赖运行时 listPrice），
     * 原始查询下恒为 0，须读 productVariantPrices 关联按渠道匹配取真实价格。
     */
    private resolvePrice;
}
