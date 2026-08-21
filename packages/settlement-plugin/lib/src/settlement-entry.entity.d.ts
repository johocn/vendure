import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/** 结算明细：一次按店入账。orderId×shopId 唯一 → 幂等防重。金额「分」整数。 */
export declare class SettlementEntry extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SettlementEntry>);
    channelId: number;
    shopId: number;
    orderId: number;
    orderCode: string;
    goodsAmountWithTax: number;
    shippingAmountWithTax: number;
    commissionAmount: number;
    netAmountWithTax: number;
    /** 可选 Date 列勿写死 type（阶段11 铁律）。 */
    settledAt?: Date;
    channels: Channel[];
}
