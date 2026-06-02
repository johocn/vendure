import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class GroupBuyOrder extends VendureEntity {
    constructor(input?: DeepPartial<GroupBuyOrder>);
    groupBuyActivityId: string;
    orderId: string;
    isLeader: boolean;
    status: 'pending' | 'success' | 'failed';
}
