import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/** 商家资金账户：一店一账户。金额一律「分」整数。 */
export declare class MerchantAccount extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MerchantAccount>);
    channelId: number;
    shopId: number;
    /** 平台佣金率（%），可配置。 */
    commissionRate: number;
    /** 可提现余额（分）。 */
    availableBalance: number;
    /** 累计商品货款（分）。 */
    totalGoodsAmount: number;
    /** 累计分摊运费（分）。 */
    totalShippingAmount: number;
    /** 累计平台佣金（分）。 */
    totalCommission: number;
    /** 累计已提现（分）。 */
    totalWithdrawn: number;
    channels: Channel[];
}
