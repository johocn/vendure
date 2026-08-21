import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { SubscriptionFrequency } from './types';
/** 周期购套餐档：绑定店铺，多频次 + N 期 + 每期价格 + 组合模板。 */
export declare class SubscriptionPlan extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SubscriptionPlan>);
    channelId: number;
    shopId: number;
    title: string;
    description?: string;
    /** 多频次：{kind:'daily'} | {kind:'weekly',dayOfWeek} | {kind:'everyNDays',interval}。simple-json 避免跨库枚举风险。 */
    frequency: SubscriptionFrequency;
    /** 期数 N。 */
    periods: number;
    /** 每期价格（分）。 */
    periodPrice: number;
    /** 组合模板 [{variantId,quantity}]，供卖家逐期快速预设（simple-json）。 */
    templateItems?: Array<{
        variantId: string | number;
        quantity: number;
    }>;
    enabled: boolean;
    channels: Channel[];
}
