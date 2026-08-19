import { pick } from '@vendure/common/lib/pick';
import {
    LocationWithQuantity,
    Logger,
    MultiChannelStockLocationStrategy,
    Order,
    OrderLine,
    RequestContext,
    StockLocation,
} from '@vendure/core';
import { distanceKm } from './location-utils';

const loggerCtx = 'NearestStockLocationStrategy';

/**
 * 订单级地理信息：来自 Order 的自定义字段（lat/lng/city）。
 * 普通配送：lat/lng 为顾客定位（前端定位后写入）；
 * 到店自提（deliveryType=pickup）：优先用自提点坐标快照 pickupLat/pickupLng 作为就近锚点。
 * city 为服务城市（与仓库/门店的 serviceCities 比对做超区门禁，自提场景应写为自提点所在城市）。
 */
interface OrderGeo {
    lat: number | null;
    lng: number | null;
    city: string | null;
}

async function readOrderGeo(
    ctx: RequestContext,
    orderLine: OrderLine,
    connection: any,
): Promise<OrderGeo> {
    let order = orderLine.order as (Order | undefined);
    // createAllocationsForOrderLines 加载 OrderLine 时未带 order 关系（orderLine.order 为 undefined），
    // 必须按 orderId 补查 Order，否则经纬度/城市永远读不到，就近分配退化为默认顺序。
    if (!order && (orderLine as any).orderId != null) {
        try {
            order = await connection
                .getRepository(ctx, Order)
                .findOne({ where: { id: (orderLine as any).orderId as any } });
        } catch (e: any) {
            order = undefined;
        }
    }
    // OrderLine 实体未声明 orderId 列（TypeORM 不会自动填充 FK 属性），
    // 兜底：重载 OrderLine 并带上 order 关系，从 order.customFields 读取经纬度/城市。
    if (!order) {
        try {
            const freshLine = await connection
                .getRepository(ctx, OrderLine)
                .findOne({ where: { id: orderLine.id }, relations: ['order'] });
            order = (freshLine?.order as (Order | undefined)) ?? undefined;
        } catch (e: any) {
            order = undefined;
        }
    }
    const cf = ((order as any)?.customFields ?? {}) as Record<string, any>;
    let lat = cf.lat != null ? Number(cf.lat) : NaN;
    let lng = cf.lng != null ? Number(cf.lng) : NaN;
    // 到店自提：以自提点坐标为核心（替代顾客定位），确保分配到离自提点最近的仓/门店
    if (cf.deliveryType === 'pickup') {
        const pLat = cf.pickupLat != null ? Number(cf.pickupLat) : NaN;
        const pLng = cf.pickupLng != null ? Number(cf.pickupLng) : NaN;
        if (isFinite(pLat) && isFinite(pLng)) {
            lat = pLat;
            lng = pLng;
        }
    }
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
        Logger.info(
            `forAllocation called line#${orderLine.id} qty=${quantity} locs=${stockLocations.length}`,
            loggerCtx,
        );
        const ordered = await this.orderByProximity(ctx, stockLocations, orderLine);
        const result = await super.forAllocation(ctx, ordered, orderLine, quantity);
        // 记录原分配仓：就近结果中数量为正的首个 location，供售后回补定位原发货仓
        await this.persistAllocationLocation(ctx, orderLine, result);
        return result;
    }

    /**
     * 将原分配仓写入 OrderLine 自定义字段 stockLocationId。
     * 失败仅告警，绝不阻断下单/分配主流程。
     */
    private async persistAllocationLocation(
        ctx: RequestContext,
        orderLine: OrderLine,
        result: LocationWithQuantity[],
    ): Promise<void> {
        try {
            const chosen = result.find(r => r.quantity > 0);
            if (!chosen) {
                Logger.warn(`orderLine#${orderLine.id} 分配结果无正数量仓，跳过记录原发货仓`, loggerCtx);
                return;
            }
            const locId = String(chosen.location.id);
            const current = (orderLine.customFields as any)?.stockLocationId;
            if (current != null && String(current) === locId) {
                return; // 已一致，无需重复写
            }
            const repo = this.connection.getRepository(ctx, OrderLine);
            // 注意：Vendure 的 customFields 是嵌入式列，repo.update 无法可靠更新（会被静默丢弃），
            // 必须按核心惯例 save(pick(entity, ['id','customFields'])) 更新。
            const fresh = await repo.findOne({ where: { id: orderLine.id } as any });
            if (!fresh) {
                Logger.warn(`orderLine#${orderLine.id} 重载失败，跳过记录原发货仓`, loggerCtx);
                return;
            }
            fresh.customFields = {
                ...(fresh.customFields ?? {}),
                stockLocationId: locId,
            };
            await repo.save(pick(fresh, ['id', 'customFields']) as any, { reload: false });
            (orderLine.customFields as any).stockLocationId = locId;
            Logger.info(`orderLine#${orderLine.id} 原分配仓 -> loc#${locId}`, loggerCtx);
        } catch (e: any) {
            Logger.error(`记录原分配仓失败（不影响下单）: ${e?.message ?? e}`, loggerCtx);
        }
    }

    private async orderByProximity(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
    ): Promise<StockLocation[]> {
        const geo = await readOrderGeo(ctx, orderLine, this.connection);
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