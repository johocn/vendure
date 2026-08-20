import { PromotionItemAction } from '@vendure/core';
/**
 * 拼团价动作：依赖 group_buy_discount 条件（condition 已把活动 groupPrice 放入 state）。
 * 仅对命中拼团变体的行，按「原价 - 拼团价」折让（PromotionItemAction 返回值须为负数）。
 */
export declare const groupBuyPriceAction: PromotionItemAction<any, []>;
