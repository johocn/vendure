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
    constructor(input?: DeepPartial<CampusFulfillmentConfig>);
}
