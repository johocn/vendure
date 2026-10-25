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
    /** 商品主图绝对地址前缀（Vendure 资产服务公网域名）；未配置则文档省略 thumbnail */
    private assetBase;
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
    /**
     * 商品所属全部渠道（数值升序去重）；无关联时回退默认渠道 '1'。
     * 商品常同时挂在默认渠道与多个租户渠道，只存单一渠道会导致其它渠道搜不到。
     */
    private resolveChannelIds;
    /**
     * 取价照 vcash-pos-plugin 口径：ProductVariant.price 是 @Calculated 字段（依赖运行时 listPrice），
     * 原始查询下恒为 0，须读 productVariantPrices 关联按渠道匹配取真实价格。
     */
    private resolvePrice;
}
