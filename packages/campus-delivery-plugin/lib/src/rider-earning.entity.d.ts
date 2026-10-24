import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class RiderEarning extends VendureEntity {
    [key: string]: any;
    orderId: ID;
    riderCustomerId: ID;
    amount: number;
    tip: number;
    status: string;
    channelId: ID;
    constructor(input?: DeepPartial<RiderEarning>);
}
