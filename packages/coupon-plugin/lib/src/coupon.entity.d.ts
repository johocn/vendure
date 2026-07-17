import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class Coupon extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Coupon>);
    name: string;
    description: string;
    couponType: string;
    discountValue: number;
    minSpend: number;
    maxDiscount: number;
    startAt: Date;
    endAt: Date;
    totalQuantity: number;
    claimedCount: number;
    limitPerUser: number;
    isActive: boolean;
    applicableProductIds: number[];
    applicableCategoryIds: number[];
    isNewUserOnly: boolean;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
