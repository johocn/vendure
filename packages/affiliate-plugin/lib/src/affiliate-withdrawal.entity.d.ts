import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type WithdrawalStatus = 'pending' | 'paid' | 'rejected';
export declare class AffiliateWithdrawal extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AffiliateWithdrawal>);
    channelId: number;
    channels: Channel[];
    affiliateId: number;
    /** 提现金额，分。 */
    amount: number;
    status: WithdrawalStatus;
    paidAt?: Date | null;
    note?: string | null;
}
