import { PromotionItemAction } from '@vendure/core';
/**
 * 秒杀价覆盖 Action。
 *
 * 配套 flashSaleDiscountCondition：condition 在结算期动态查活动返回
 * `{ variantId, flashPrice }` 作为 state，此 action 读 state 命中秒杀变体行后，
 * 把单价从原价下调至秒杀价（折扣 = unitPrice - flashPrice，>0 才折让）。
 *
 * execute 返回的是 OrderLine 单价应被扣减的金额（负数），
 * 由 PromotionItemAction 框架按数量累计应用到 OrderLine 上。
 */
export declare const flashSalePriceAction: PromotionItemAction<{}, []>;
