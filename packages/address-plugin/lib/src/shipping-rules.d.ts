import { Order, RequestContext, TransactionalConnection } from '@vendure/core';
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
export declare function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function parseDistrictCodes(raw: string | null): Set<string>;
export declare function evaluateRange(range: DeliveryRange | null, shopId: DeliveryResult['shopId'], addr: AddressLike): DeliveryResult;
/** 订单行 → 商品所属 ShopId 映射（沿 shop-plugin 的 Product.shopId 自定义字段反查）。 */
export declare function resolveOrderShopMap(connection: TransactionalConnection, ctx: RequestContext, order: Order): Promise<Map<number, number>>;
/** 按店聚合订单行小计 + 运费（读 DeliveryRange.baseFee/freeThreshold）。 */
export declare function computeShopFees(connection: TransactionalConnection, ctx: RequestContext, order: Order): Promise<ShopFee[]>;
/** 从 Order customFields 读收件区码/经纬度（阶段22 Order 新增字段）。 */
export declare function readOrderShippingCodes(order: Order): AddressLike;
/** 是否已具备可参与校验的收件码（任一非空）。 */
export declare function hasOrderShippingCodes(order: Order): boolean;
