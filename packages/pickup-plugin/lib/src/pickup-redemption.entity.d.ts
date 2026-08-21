import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type PickupRedemptionStatus = 'generated' | 'redeemed' | 'void';
export declare class PickupRedemption extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PickupRedemption>);
    channelId: number;
    channels: Channel[];
    orderId: number;
    code: string;
    status: PickupRedemptionStatus;
    claimedAt?: Date | null;
    claimedByUserId?: number | null;
    claimChannel?: 'customer' | 'shop' | null;
}
