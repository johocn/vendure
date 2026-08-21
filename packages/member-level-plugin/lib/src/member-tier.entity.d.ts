import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class MemberTier extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MemberTier>);
    tierLevel: number;
    threshold: number;
    name: string;
    /** 积分获取倍率（千分比，150 = 1.5 倍）。 */
    pointsMultiplier: number;
    /** 抵现折扣率（千分比，1000 = 1 分抵 1 分）。率越高每分抵得越多。 */
    redeemDiscountRate: number;
    /** 可抵占订单金额上限比例（千分比，500 = 最多抵 50%）。 */
    redeemCapRatio: number;
    /** 等级专属折扣率（千分比，0 = 无专属折扣）。 */
    specialDiscountRate: number;
    channelId: number;
    channels: Channel[];
}
