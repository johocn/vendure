import { ID, RequestContext } from '@vendure/core';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
import { InventoryAlertRuleInput, InventoryAlertRuleService } from './inventory-alert-rule.service';
import { InventoryStockPageInput, InventoryStockService } from './inventory-stock.service';
/** 管理端库存配置：变体 × 物理仓绑定 + 租户库存仓管理 + 库存明细聚合页 + 预警规则 */
export declare class InventoryAdminResolver {
    private virtualPhysicalStockService;
    private inventoryStockService;
    private inventoryAlertRuleService;
    constructor(virtualPhysicalStockService: VirtualPhysicalStockService, inventoryStockService: InventoryStockService, inventoryAlertRuleService: InventoryAlertRuleService);
    setVariantBindings(ctx: RequestContext, variantId: ID, bindings: Array<{
        locationId: ID;
        isDefault: boolean;
    }>): Promise<import("./variant-location-binding.entity").VariantLocationBinding[]>;
    /** 租户库存方案概览（开关口径 + 系统仓落点 + 仓清单） */
    tenantInventoryOverview(ctx: RequestContext): Promise<import("./virtual-physical-stock.service").TenantInventoryOverview>;
    /** 幂等补建系统仓（虚拟仓恒在；开关开启时补默认物理仓），供后台「一键初始化」与自愈 */
    ensureTenantInventoryLocations(ctx: RequestContext): Promise<import("./virtual-physical-stock.service").TenantInventoryOverview>;
    /** 新建租户物理仓（服务端自动编码 + 归属校验 + 强制 physical） */
    createTenantStockLocation(ctx: RequestContext, input: {
        name: string;
    }): Promise<import("./virtual-physical-stock.service").TenantInventoryOverview>;
    /** 更新租户仓（名称/配送方式/服务城市/坐标；编码与性质不可改） */
    updateTenantStockLocation(ctx: RequestContext, input: {
        id: ID;
    }): Promise<import("./virtual-physical-stock.service").TenantInventoryOverview>;
    /** 删除租户仓（系统仓不可删） */
    deleteTenantStockLocation(ctx: RequestContext, id: ID): Promise<import("./virtual-physical-stock.service").TenantInventoryOverview>;
    /** 库存明细聚合页：KPI + 分桶计数 + 明细行（服务端过滤/排序/分页） */
    inventoryStockPage(ctx: RequestContext, input?: InventoryStockPageInput): Promise<{
        totalItems: number;
        summary: import("./stock-page-math").StockSummary;
        items: import("./stock-page-math").StockRowCore[];
    }>;
    /** 预警规则列表（指定仓；缺省 → 该 SKU 全仓通用规则） */
    inventoryAlertRules(ctx: RequestContext, locationId?: ID): Promise<import("./inventory-alert-rule.entity").InventoryAlertRuleEntity[]>;
    /** 预警规则保存（幂等 upsert；返回该仓最新规则列表） */
    saveInventoryAlertRules(ctx: RequestContext, items: InventoryAlertRuleInput[], locationId?: ID): Promise<import("./inventory-alert-rule.entity").InventoryAlertRuleEntity[]>;
}
