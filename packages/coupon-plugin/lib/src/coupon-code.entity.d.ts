import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class CouponCode extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<CouponCode>);
    couponId: number;
    customerId: number;
    code: string;
    status: string;
    claimedAt: Date | null;
    usedAt: Date | null;
    orderId: number | null;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
