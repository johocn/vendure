import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type BindSource = 'click' | 'code';
export declare class AffiliateRelation extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AffiliateRelation>);
    channelId: number;
    channels: Channel[];
    affiliateId: number;
    /** 顾客一生只绑一次。 */
    customerId: number;
    bindSource: BindSource;
    boundAt: Date;
}
