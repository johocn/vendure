import { Injector, ID, RequestContext, StockLevel, StockLocation } from '@vendure/core';
import { MatrixStockLocationStrategy } from '@vendure/logistics-plugin';
import { VariantLocationBindingService } from './variant-location-binding.service';
/**
 * 绑定感知库存策略：在 MatrixStockLocationStrategy（就近+门禁+矩阵）之上，
 * 物理驱动变体（有 VariantLocationBinding）只从绑定物理仓分配/发货；
 * 纯虚拟变体完全走父类逻辑（虚拟仓为唯一渠道仓）。
 * 物理仓挂渠道（create 默认行为），父类渠道过滤天然通过。
 */
export declare class PhysicalAwareStockLocationStrategy extends MatrixStockLocationStrategy {
    protected bindingService: VariantLocationBindingService;
    init(injector: Injector): Promise<void>;
    private boundLocations;
    getAvailableStock(ctx: RequestContext, productVariantId: ID, stockLevels: StockLevel[]): Promise<{
        stockOnHand: number;
        stockAllocated: number;
    }>;
    private locationKindOf;
    forAllocation(ctx: RequestContext, stockLocations: StockLocation[], orderLine: any, quantity: number): Promise<import("@vendure/core").LocationWithQuantity[]>;
    private productDeliveryMethods;
    forSale(ctx: RequestContext, stockLocations: StockLocation[], orderLine: any, quantity: number): Promise<import("@vendure/core").LocationWithQuantity[]>;
    forRelease(ctx: RequestContext, stockLocations: StockLocation[], orderLine: any, quantity: number): Promise<import("@vendure/core").LocationWithQuantity[]>;
    forCancellation(ctx: RequestContext, stockLocations: StockLocation[], orderLine: any, quantity: number): Promise<import("@vendure/core").LocationWithQuantity[]>;
}
