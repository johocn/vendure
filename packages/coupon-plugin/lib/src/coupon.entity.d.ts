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
    /** 全局优惠券：由超级管理员创建，所有渠道可见 */
    isGlobal: boolean;
    /** 优惠券所属渠道 ID（全局券为 null） */
    ownerChannelId: number | null;
    channel: Channel;
    channelId: number;
    channels: Channel[];
}
