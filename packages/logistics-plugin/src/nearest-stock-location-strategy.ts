import {
    LocationWithQuantity,
    MultiChannelStockLocationStrategy,
    OrderLine,
    RequestContext,
    StockLocation,
} from '@vendure/core';
import { distanceKm } from './location-utils';

/**
 * 订单级地理信息：来自 Order 的自定义字段（lat/lng/city）。
 * lat/lng 由前端在 C 端定位后写入；city 为服务城市（与仓库/门店的 serviceCities 比对做超区门禁）。
 */
interface OrderGeo {
    lat: number | null;
    lng: number | null;
    city: string | null;
}

function readOrderGeo(orderLine: OrderLine): OrderGeo {
    const cf = ((orderLine.order as any)?.customFields ?? {}) as Record<string, any>;
    const lat = cf.lat != null ? Number(cf.lat) : NaN;
    const lng = cf.lng != null ? Number(cf.lng) : NaN;
    return {
        lat: isFinite(lat) ? lat : null,
        lng: isFinite(lng) ? lng : null,
        city: cf.city ? String(cf.city) : null,
    };
}

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
export class NearestStockLocationStrategy extends MultiChannelStockLocationStrategy {
    override async forAllocation(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<LocationWithQuantity[]> {
        const ordered = this.orderByProximity(stockLocations, orderLine);
        return super.forAllocation(ctx, ordered, orderLine, quantity);
    }

    private orderByProximity(
        stockLocations: StockLocation[],
        orderLine: OrderLine,
    ): StockLocation[] {
        const geo = readOrderGeo(orderLine);
        let candidates = stockLocations;

        // 超区门禁：订单带城市时，仅保留服务该城市的仓库/门店
        if (geo.city) {
            const serving = stockLocations.filter(loc => this.servesCity(loc, geo.city!));
            if (serving.length > 0) {
                candidates = serving;
            }
            // 全部超区时保留原列表（前端已做超区提示，这里不中断下单，仍可履约）
        }

        // 就近：订单带定位时按距离升序
        if (geo.lat != null && geo.lng != null) {
            return [...candidates].sort(
                (a, b) => this.locationDistanceKm(a, geo) - this.locationDistanceKm(b, geo),
            );
        }
        return candidates;
    }

    private servesCity(loc: StockLocation, city: string): boolean {
        const serviceCities = (loc.customFields as any)?.serviceCities;
        if (!Array.isArray(serviceCities) || serviceCities.length === 0) {
            return true; // 未配置服务城市 = 全域可服务
        }
        return serviceCities.includes(city);
    }

    private locationDistanceKm(loc: StockLocation, geo: OrderGeo): number {
        const cf = (loc.customFields as any) ?? {};
        const lat = cf.lat != null ? Number(cf.lat) : NaN;
        const lng = cf.lng != null ? Number(cf.lng) : NaN;
        if (!isFinite(lat) || !isFinite(lng)) {
            return Number.MAX_SAFE_INTEGER;
        }
        return distanceKm({ lat, lng }, { lat: geo.lat!, lng: geo.lng! });
    }
}