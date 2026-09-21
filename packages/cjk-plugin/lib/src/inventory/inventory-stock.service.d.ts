import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { InventoryAlertRuleService } from './inventory-alert-rule.service';
import { type StockRowCore, type StockSummary } from './stock-page-math';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
export interface InventoryStockPageInput {
    locationId?: ID | null;
    keyword?: string;
    bucket?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
}
/** 库存明细聚合页（一次请求拿齐 KPI / 分桶计数 / 明细行） */
export declare class InventoryStockService {
    private conn;
    private virtualPhysicalStockService;
    private alertRuleService;
    constructor(conn: TransactionalConnection, virtualPhysicalStockService: VirtualPhysicalStockService, alertRuleService: InventoryAlertRuleService);
    /**
     * 仓库范围解析：locationId 空 → 本租户仓列表（优先物理仓；无物理仓退回全部仓）；
     * 给定 → 单仓且必须归属本租户，否则拒绝。
     */
    private resolveLocations;
    /** 关键词预筛：变体名（任意语言）命中的变体 id 集合 */
    private nameMatchedVariantIds;
    /** 关键词预筛：规格（选项名，任意语言）命中的变体 id 集合（避免硬编码 ManyToMany 连接表名） */
    private optionMatchedVariantIds;
    /** 按变体聚合现存/占用 + sku/productId（一条 SQL，分组在库内完成） */
    private loadAggregates;
    /** 最近一次采购/移库成本价（分）：按 id 降序后在 TS 端取每变体第一条（避免窗口函数方言差异） */
    private loadLatestCost;
    /** 最近一次流水（变体级）+ 近 7 天出库合计（渠道 scoping 与 pickup 一致） */
    private loadLedgerInfo;
    /** 页内富化：缩略图（asset.preview）+ 选项文本 + 变体名（按当前语言，缺则首个翻译，再缺则 sku） */
    private loadEnrich;
    /** 页面主入口：一次请求返回 totalItems + summary + 当前页明细 */
    page(ctx: RequestContext, input?: InventoryStockPageInput | null): Promise<{
        totalItems: number;
        summary: StockSummary;
        items: StockRowCore[];
    }>;
}
