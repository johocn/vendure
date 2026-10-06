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
    constructor(input?: DeepPartial<CampusFulfillmentConfig>);
}
