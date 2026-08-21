import { Order, Product, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { DeliveryRange } from './delivery-range.entity';

export interface AddressLike {
    lng?: number | null;
    lat?: number | null;
    provinceCode?: string | null;
    cityCode?: string | null;
    districtCode?: string | null;
}

export interface DeliveryResult {
    shopId: number | string;
    inRange: boolean;
    reason: string;
}

export interface ShopFee {
    shopId: number;
    subtotal: number;
    baseFee: number;
    freeThreshold: number | null;
    fee: number;
}

/** 大地距离（km），haversine 公式。 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

export function parseDistrictCodes(raw: string | null): Set<string> {
    if (!raw) {
        return new Set();
    }
    try {
        return new Set<string>(JSON.parse(raw) as string[]);
    } catch {
        return new Set();
    }
}

export function evaluateRange(range: DeliveryRange | null, shopId: DeliveryResult['shopId'], addr: AddressLike): DeliveryResult {
    if (!range || !range.enabled) {
        return { shopId, inRange: false, reason: 'NO_DELIVERY' };
    }
    if (range.rangeType === 'all') {
        return { shopId, inRange: true, reason: 'OK' };
    }
    if (range.rangeType === 'circle') {
        if (addr.lat == null || addr.lng == null) {
            return { shopId, inRange: false, reason: 'NO_COORDINATES' };
        }
        const d = haversineKm(range.centerLat ?? 0, range.centerLng ?? 0, addr.lat, addr.lng);
        if (d <= (range.radiusKm ?? 0)) {
            return { shopId, inRange: true, reason: 'OK' };
        }
        return { shopId, inRange: false, reason: 'BEYOND_RANGE' };
    }
    if (range.rangeType === 'district') {
        const whitelist = parseDistrictCodes(range.districtCodes);
        const has = [addr.districtCode, addr.cityCode, addr.provinceCode].some(
            code => code != null && whitelist.has(code),
        );
        if (has) {
            return { shopId, inRange: true, reason: 'OK' };
        }
        return { shopId, inRange: false, reason: 'NOT_IN_RANGE' };
    }
    return { shopId, inRange: false, reason: 'UNKNOWN_TYPE' };
}

/** 订单行 → 商品所属 ShopId 映射（沿 shop-plugin 的 Product.shopId 自定义字段反查）。 */
export async function resolveOrderShopMap(
    connection: TransactionalConnection,
    ctx: RequestContext,
    order: Order,
): Promise<Map<number, number>> {
    const lines = ((order as any)?.lines ?? []) as any[];
    // OrderLine 无 productId 列，productId 挂在 line.productVariant.productId 上。
    const productIds = [
        ...new Set(lines.map(l => Number(l.productVariant?.productId) || Number(l.productId)).filter(id => id > 0)),
    ];
    const map = new Map<number, number>();
    if (productIds.length === 0) {
        return map;
    }
    const products = await connection
        .getRepository(ctx, Product)
        .find({ where: { id: In(productIds) } as any });
    const shopByProduct = new Map<number, number>();
    for (const p of products) {
        const sid = ((p.customFields ?? {}) as any)?.shopId;
        if (sid != null) {
            shopByProduct.set(Number(p.id), Number(sid));
        }
    }
    for (const l of lines) {
        const pid = Number(l.productVariant?.productId) || Number(l.productId);
        const sid = shopByProduct.get(pid);
        if (sid != null) {
            map.set(pid, sid);
        }
    }
    return map;
}

/** 按店聚合订单行小计 + 运费（读 DeliveryRange.baseFee/freeThreshold）。 */
export async function computeShopFees(
    connection: TransactionalConnection,
    ctx: RequestContext,
    order: Order,
): Promise<ShopFee[]> {
    const productShop = await resolveOrderShopMap(connection, ctx, order);
    const subtotals = new Map<number, number>();
    for (const l of ((order as any)?.lines ?? []) as any[]) {
        const pid = Number(l.productVariant?.productId) || Number(l.productId);
        const sid = productShop.get(pid);
        if (sid == null) {
            continue;
        }
        subtotals.set(sid, (subtotals.get(sid) ?? 0) + (Number(l.linePriceWithTax) || 0));
    }
    const repo = connection.getRepository(ctx, DeliveryRange);
    const out: ShopFee[] = [];
    for (const [shopId, subtotal] of subtotals) {
        const range = await repo.findOne({
            where: { shopId, channelId: ctx.channelId as number } as any,
        });
        const baseFee = range ? range.baseFee : 0;
        const freeThreshold = range ? range.freeThreshold : null;
        const free = freeThreshold != null && freeThreshold > 0 && subtotal >= freeThreshold;
        const fee = free ? 0 : baseFee;
        out.push({ shopId, subtotal, baseFee, freeThreshold, fee });
    }
    return out;
}

/** 从 Order customFields 读收件区码/经纬度（阶段22 Order 新增字段）。 */
export function readOrderShippingCodes(order: Order): AddressLike {
    const cf = ((order as any)?.customFields ?? {}) as Record<string, any>;
    return {
        lng: cf?.shippingLng ?? null,
        lat: cf?.shippingLat ?? null,
        provinceCode: cf?.shippingProvinceCode ?? null,
        cityCode: cf?.shippingCityCode ?? null,
        districtCode: cf?.shippingDistrictCode ?? null,
    };
}

/** 是否已具备可参与校验的收件码（任一非空）。 */
export function hasOrderShippingCodes(order: Order): boolean {
    const c = readOrderShippingCodes(order);
    return [c.lng, c.lat, c.provinceCode, c.cityCode, c.districtCode].some(v => v != null && v !== '');
}