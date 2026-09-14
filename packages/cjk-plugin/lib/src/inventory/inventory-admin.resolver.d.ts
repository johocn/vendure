import { ID, RequestContext } from '@vendure/core';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
/** 管理端库存配置：变体 × 物理仓绑定（物理驱动变体由此开启） */
export declare class InventoryAdminResolver {
    private virtualPhysicalStockService;
    constructor(virtualPhysicalStockService: VirtualPhysicalStockService);
    setVariantBindings(ctx: RequestContext, variantId: ID, bindings: Array<{
        locationId: ID;
        isDefault: boolean;
    }>): Promise<import("./variant-location-binding.entity").VariantLocationBinding[]>;
}
