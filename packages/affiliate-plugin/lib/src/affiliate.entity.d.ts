import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type AffiliateStatus = 'active' | 'suspended';
export declare class Affiliate extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Affiliate>);
    channelId: number;
    channels: Channel[];
    /** 推广员登录 User。 */
    userId: number;
    /** 空 = 全局推广。 */
    shopId?: number | null;
    /** 推广码，唯一防碰撞。 */
    code: string;
    status: AffiliateStatus;
    /** 累计佣金，分。 */
    totalCommission: number;
    /** 可提现余额，分。 */
    withdrawableCommission: number;
}
