import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type CommissionStatus = 'pending' | 'paid' | 'reversed';
export type LoadOn = 'merchant' | 'platform';
export declare class AffiliateCommissionEntry extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AffiliateCommissionEntry>);
    channelId: number;
    channels: Channel[];
    affiliateId: number;
    customerId: number;
    orderId: number;
    orderLineId: number;
    shopId: number;
    /** 成交额，分。 */
    baseAmount: number;
    /** 千分比。 */
    rate: number;
    /** 佣金，分。 */
    commissionAmount: number;
    loadOn: LoadOn;
    status: CommissionStatus;
    withdrawalId?: number | null;
}
