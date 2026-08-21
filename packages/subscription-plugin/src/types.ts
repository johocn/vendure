import { ID } from '@vendure/core';

export interface SubscriptionPluginOptions {
    /** 每日调度 cron 表达式（默认每天 04:00 扫描到期期次）。 */
    scheduleCron?: string;
    /** 默认取货/配送支付方式代码，用于每期生成订单时标记已支付。缺省用插件装配的支付方式。 */
    paymentMethodCode?: string;
    /** 平台统一征收买断总价（true 时 createSubscription 视为平台已收，无需真实支付网关）。默认 true。 */
    collectBuyoutCentrally?: boolean;
}

export interface SubscriptionListOptions {
    skip?: number;
    take?: number;
}

/** 多频次定义。 */
export declare type SubscriptionFrequency =
    | { kind: 'daily' }
    | { kind: 'weekly'; dayOfWeek: number }
    | { kind: 'everyNDays'; interval: number };

/** 商品清单项。 */
export interface SubscriptionItem {
    variantId: ID;
    quantity: number;
}