import { CustomerService, ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryAddress } from './delivery-address.entity';
import { DeliveryRange } from './delivery-range.entity';
export interface AddressInput {
    fullName: string;
    phone: string;
    province?: string | null;
    city?: string | null;
    district?: string | null;
    provinceCode?: string | null;
    cityCode?: string | null;
    districtCode?: string | null;
    detail?: string | null;
    lng?: number | null;
    lat?: number | null;
}
export interface RangeInput {
    shopId: ID;
    enabled?: boolean;
    rangeType?: string;
    centerLng?: number | null;
    centerLat?: number | null;
    radiusKm?: number | null;
    districtCodes?: string[] | null;
    /** 基础运费（分）。 */
    baseFee?: number | null;
    /** 满额包邮阈值（分）；null=该店不支持包邮。 */
    freeThreshold?: number | null;
}
export interface DeliveryResult {
    shopId: ID;
    inRange: boolean;
    reason: string;
}
export declare class DeliveryService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    /** 当前登录顾客；未登录抛 Unauthorized，无顾客抛 NotFound（对齐 review 口径）。 */
    private requireCustomer;
    listMyAddresses(ctx: RequestContext): Promise<DeliveryAddress[]>;
    createAddress(ctx: RequestContext, input: AddressInput): Promise<DeliveryAddress>;
    getAddress(ctx: RequestContext, id: ID): Promise<DeliveryAddress>;
    updateAddress(ctx: RequestContext, id: ID, input: AddressInput): Promise<DeliveryAddress>;
    deleteAddress(ctx: RequestContext, id: ID): Promise<boolean>;
    /** 设为默认：事务内先清空该顾客全部默认，再置目标为默认（保证唯一）。 */
    setDefaultAddress(ctx: RequestContext, id: ID): Promise<DeliveryAddress[]>;
    /** 校验 shop 存在（复用 shop-plugin Shop，repository 直接取避免 DI 环）。 */
    private requireShop;
    getRange(ctx: RequestContext, shopId: ID): Promise<DeliveryRange | null>;
    /** 每店每渠道单档 upsert：存在则 update，否则 insert（幂等）。 */
    upsertRange(ctx: RequestContext, input: RangeInput): Promise<DeliveryRange>;
    validateDelivery(ctx: RequestContext, address: AddressInput, shopIds: ID[]): Promise<DeliveryResult[]>;
    /** 当前订单行所属商品去重后的 shopId 列表（沿 Product.shopId 反查）。 */
    getOrderShopIds(ctx: RequestContext, order: any): Promise<number[]>;
    /** 读取订单当前收件码/经纬度并逐店校验可得性。 */
    evaluateOrderDelivery(ctx: RequestContext, order: any, shopIds?: number[]): Promise<DeliveryResult[]>;
    /** 是否已具备收件码可参与校验。 */
    hasOrderShippingCodes(order: any): boolean;
    /** 从地址簿写入订单收件码/经纬度（stage22 前置：setOrderShippingFromAddress）。 */
    applyAddressToOrderShipping(order: any, address: DeliveryAddress): void;
    private evaluateRange;
    private parseDistrictCodes;
    /** 大地距离（km），haversine 公式。 */
    private haversineKm;
}
