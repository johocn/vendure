import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class CampusFulfillmentConfig extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    routesEnabled: string[];
    riderCommissionRate: number;
    autoAssignMinutes: number;
    paused: boolean;
    autoRefundMinutes: number;
    inProgressSlaMinutes: number;
    compensationCouponTemplateId: string;
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    errandBaseFee: number | null;
    freeShippingThreshold: number | null;
    merchantConfirmEnabled: boolean;
    merchantAutoOpenMinutes: number;
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
    printMode: string | null;
    /** 第一段由谁送（按路线）：R1 = merchant|owned，R3 = campus|owned|external；缺省 R1=merchant、R3=campus */
    routeFirstLeg: Record<string, string> | null;
    /** 校园交接点：R1/R2 各一个（键为路线号） */
    handoverPoints: Record<string, {
        name: string;
        address?: string;
        phone?: string;
        lat: number;
        lng: number;
    }> | null;
    /** 外部快递各 provider 的门店编号：{ dada?: string, meituan?: string } */
    providerShopNo: Record<string, string> | null;
    /** R1 商户接单超时（分钟），超时自动转自营快递；0 = 不自动转 */
    merchantAcceptMinutes: number;
    /** 等运营推送外部快递的超时（分钟），超时退回抢单大厅 */
    externalPushTimeoutMinutes: number;
    /** 已推送外部快递但久未接单/取货的超时（分钟），超时取消并退回抢单大厅 */
    externalFallbackMinutes: number;
    storeLat: number | null;
    storeLng: number | null;
    constructor(input?: DeepPartial<CampusFulfillmentConfig>);
}
