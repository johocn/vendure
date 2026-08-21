import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class CommunityParticipation extends VendureEntity {
    constructor(input?: DeepPartial<CommunityParticipation>);
    activityId: number;
    orderId: number;
    leaderId: number;
    subtotal: number;
}
