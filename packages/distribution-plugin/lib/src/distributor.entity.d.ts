import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class Distributor extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Distributor>);
    customerId: string;
    parentId: string;
    level: number;
    status: 'active' | 'frozen' | 'pending';
    totalEarnings: number;
    availableBalance: number;
    frozenBalance: number;
    referralCode: string;
    channels: Channel[];
}
