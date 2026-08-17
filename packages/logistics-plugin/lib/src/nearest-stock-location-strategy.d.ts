import { LocationWithQuantity, MultiChannelStockLocationStrategy, OrderLine, RequestContext, StockLocation } from '@vendure/core';
/**
 * 就近发货 + 服务范围门禁 的 StockLocationStrategy。
 *
 * 继承 {@link MultiChannelStockLocationStrategy}（保留其库存核算/渠道过滤能力），
 * 仅覆写 `forAllocation`：在下单分配库存时，
 *   1) 若订单带定位 → 按订单经纬度与仓库距离升序排列（真正的"就近"）；
 *   2) 若订单带城市 → 先过滤出服务该城市的仓库（超区门禁）；
 *   3) 订单无定位时退化为父级默认分配顺序。
 *
 * 仓库/门店的经纬度与服务城市从 StockLocation 自定义字段 `lat/lng/serviceCities` 读取。
 */
export declare class NearestStockLocationStrategy extends MultiChannelStockLocationStrategy {
    forAllocation(ctx: RequestContext, stockLocations: StockLocation[], orderLine: OrderLine, quantity: number): Promise<LocationWithQuantity[]>;
    private orderByProximity;
    private servesCity;
    private locationDistanceKm;
}
