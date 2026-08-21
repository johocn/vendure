import { DeepPartial, VendureEntity } from '@vendure/core';
export type CommunityCommissionStatus = 'pending' | 'paid';
export declare class CommunityCommissionEntry extends VendureEntity {
    constructor(input?: DeepPartial<CommunityCommissionEntry>);
    leaderId: number;
    orderId: number;
    amount: number;
    status: CommunityCommissionStatus;
}
