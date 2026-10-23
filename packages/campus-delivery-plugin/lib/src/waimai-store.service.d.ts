import { RequestContext, TransactionalConnection } from '@vendure/core';
export interface WaimaiStore {
    channelId: number;
    channelToken: string;
    name: string;
    logo: string | null;
    tags: string[];
    monthlySales: number;
    promoText: string | null;
    paused: boolean;
    routesEnabled: string[];
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    businessHours: string | null;
    errandBaseFee: number | null;
    freeShippingThreshold: number | null;
}
export interface CampusStoreConfigWithChannel {
    channelId: number;
    channelName: string;
    channelToken: string;
    routesEnabled: string[];
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    errandBaseFee: number | null;
    freeShippingThreshold: number | null;
    notifyTemplateAccepted: string | null;
    notifyTemplateRiderAssigned: string | null;
    notifyTemplateCookingDone: string | null;
    notifyTemplateDelivered: string | null;
    notifyTemplateExceptionHandled: string | null;
    notifyTemplateOrderPlaced: string | null;
    notifyTemplatePaymentPending: string | null;
    notifyTemplateCancelled: string | null;
    notifyTemplateAfterSales: string | null;
    h5BaseUrl: string | null;
    printMode: 'off' | 'onPaid' | 'onAccepted';
    routeFirstLeg: Array<{
        route: string;
        carrier: string;
    }>;
    handoverPoints: Array<{
        route: string;
        name: string;
        address: string | null;
        phone: string | null;
        lat: number;
        lng: number;
        isDefault: boolean;
    }>;
    providerShopNo: Array<{
        provider: string;
        shopNo: string;
    }>;
    merchantAcceptMinutes: number;
    externalPushTimeoutMinutes: number;
    externalFallbackMinutes: number;
    storeLat: number | null;
    storeLng: number | null;
    timeoutCompensationEnabled: boolean;
    timeoutGraceMinutes: number;
    timeoutCompensationCouponTemplateId: string | null;
}
declare const PRINT_MODES: readonly ["off", "onPaid", "onAccepted"];
type PrintMode = (typeof PRINT_MODES)[number];
/** printMode 归一化：null/非法值一律回 'off'（存量行与脏配置兜底） */
export declare function normalizePrintMode(v: unknown): PrintMode;
export declare class WaimaiStoreService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 店铺列表：有履约配置的渠道即外卖店铺（跨渠道公开元数据聚合，供 C 端首页）。
     * C 端进入店铺后用 channelToken 作 vendure-token 切换渠道拉菜单/下单。 */
    listStores(ctx: RequestContext): Promise<WaimaiStore[]>;
    /** admin：全店铺配置（跨渠道，join Channel 取店铺名/token；默认渠道是平台会话渠道，跳过） */
    listStoreConfigs(ctx: RequestContext): Promise<CampusStoreConfigWithChannel[]>;
    /** admin：按 channelId upsert（幂等），routesEnabled 白名单 R1-R5，负数金额拒绝 */
    updateStoreConfig(ctx: RequestContext, channelId: number, input: {
        routesEnabled: string[];
        deliveryMinutes?: number | null;
        minOrderAmount?: number | null;
        deliveryFee?: number | null;
        storeAddress?: string | null;
        storePhone?: string | null;
        storeNotice?: string | null;
        errandBaseFee?: number | null;
        freeShippingThreshold?: number | null;
        notifyTemplateAccepted?: string | null;
        notifyTemplateRiderAssigned?: string | null;
        notifyTemplateCookingDone?: string | null;
        notifyTemplateDelivered?: string | null;
        notifyTemplateExceptionHandled?: string | null;
        notifyTemplateOrderPlaced?: string | null;
        notifyTemplatePaymentPending?: string | null;
        notifyTemplateCancelled?: string | null;
        notifyTemplateAfterSales?: string | null;
        h5BaseUrl?: string | null;
        printMode?: string | null;
        timeoutCompensationEnabled?: boolean | null;
        timeoutGraceMinutes?: number | null;
        timeoutCompensationCouponTemplateId?: string | null;
        routeFirstLeg?: Array<{
            route: string;
            carrier: string;
        }> | null;
        handoverPoints?: Array<{
            route: string;
            name: string;
            address?: string | null;
            phone?: string | null;
            lat: number;
            lng: number;
            isDefault?: boolean | null;
        }> | null;
        providerShopNo?: Array<{
            provider: string;
            shopNo: string;
        }> | null;
        merchantAcceptMinutes?: number | null;
        externalPushTimeoutMinutes?: number | null;
        externalFallbackMinutes?: number | null;
        storeLat?: number | null;
        storeLng?: number | null;
    }): Promise<CampusStoreConfigWithChannel>;
    /** 经 rawConnection 按实体名取 repo（避免对 cjk-plugin 的构建期依赖；PickupLocation 由 cjk-plugin 注册于同一进程）。
     * 可见性：isPublic=false + ownerChannelId=本渠道 + channels 含本渠道 → shop 端 applyVisibility 对本渠道可见（cjk pickup-location.service.ts:35）。 */
    private upsertStorePickupLocation;
    private toConfigView;
}
export {};
