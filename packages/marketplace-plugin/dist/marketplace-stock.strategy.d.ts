import { Injector, LocationWithQuantity, OrderLine, RequestContext, StockLocation } from '@vendure/core';
import { NearestStockLocationStrategy } from '@vendure/logistics-plugin';
/**
 * @description
 * 组合库存策略：继承 {@link NearestStockLocationStrategy}（就近发货 + 多仓数量拆分 +
 * 原发货仓记录 orderLine.customFields.stockLocationId），仅在下单分配库存时按销售来源
 * 预筛目标仓，其余逻辑（分配/释放/销售/取消、多仓核算、原发货仓留痕）全部委托父级：
 *
 * - marketplace 销售 → 仅用 `<商家>-marketplace` 仓
 * - 普通销售 → 仅用 `<商家>-store` 仓
 *
 * 预筛后交给父级完成就近分配与库存核算，保证：
 *   1) 每个 location 只分配应分配的数量（不再对全部仓各写全量 ALLOCATION 流水）；
 *   2) orderLine.customFields.stockLocationId 被正确记录，供售后回补定位原发货仓。
 */
export declare class MarketplaceStockLocationStrategy extends NearestStockLocationStrategy {
    private entityHydrator;
    init(injector: Injector): Promise<void>;
    forAllocation(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    private isMarketplaceSale;
}
