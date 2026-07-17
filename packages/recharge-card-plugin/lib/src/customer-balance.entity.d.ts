import { Channel, Customer, DeepPartial, VendureEntity } from '@vendure/core';
export declare class CustomerBalance extends VendureEntity {
    constructor(input?: DeepPartial<CustomerBalance>);
    customer: Customer;
    customerId: number;
    channel: Channel;
    channelId: number;
    balance: number;
    frozenBalance: number;
}
