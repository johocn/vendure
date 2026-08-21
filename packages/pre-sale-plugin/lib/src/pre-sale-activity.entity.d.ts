import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type PreSaleMode = 'deposit' | 'full';
export type PreSaleStatus = 'upcoming' | 'active' | 'delivered' | 'ended';
/**
 * 预售活动。
 * 支持三种模式：
 * - full（全款预售）：预售期一次性收全款 → 到货后发货
 * - deposit（定金预售）：先收定金 → 到货/尾款窗口开启后收尾款 → 补齐后发货
 * - 预售价格分档：presalePrice < 原价，结算期 Promotion 动态打折到预售价
 */
export declare class PreSaleActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PreSaleActivity>);
    name: string;
    /** deposit（定金）/ full（全款） */
    mode: PreSaleMode;
    startAt: Date;
    endAt: Date;
    /** 到货/开售时间（尾款开启或全款发货 latch） */
    releaseAt?: Date;
    /** 尾款支付窗口开启时间（deposit 模式） */
    tailStartAt?: Date;
    /** 尾款支付窗口截止时间（deposit 模式） */
    tailEndAt?: Date;
    /** 预售价（分）；<=0 表示无价格分档，用原价 */
    presalePrice: number;
    /** 定金金额（分）；deposit 模式用，<=0 时落到全款语义 */
    depositAmount: number;
    totalStock: number;
    soldCount: number;
    limitPerUser: number;
    productId: number;
    variantId: number;
    channelId: number;
    status: PreSaleStatus;
    channels: Channel[];
}
