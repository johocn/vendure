import { ID, RequestContext } from '@vendure/core';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
/** 管理端库存配置：变体 × 物理仓绑定（物理驱动变体由此开启）+ 租户库存仓管理 */
export declare class InventoryAdminResolver {
    private virtualPhysicalStockService;
    constructor(virtualPhysicalStockService: VirtualPhysicalStockService);
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
}
