import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class RiderCreditLog extends VendureEntity {
    [key: string]: any;
    customerId: number;
    delta: number;
    reason: string;
    orderId: ID;
    channelId: ID;
    constructor(input?: DeepPartial<RiderCreditLog>);
}
