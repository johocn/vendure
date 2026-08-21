import { PromotionCondition } from '@vendure/core';
/**
 * 预售价条件：读 order.customFields.preSaleActivityId，
 * 运行时查询活动并校验（存在、非 ended、窗口内、库存未售罄）后，
 * 返回 state `{ variantId, presalePrice, usePresale }` 供 pre_sale_price 动作取价。
 *
 * 与阶段14/15 一致：活动配置运行时动态读取，无需在管理端按活动手工配 args。
 */
export declare const preSaleDiscountCondition: PromotionCondition<{}, "pre_sale_discount", false | {
    variantId: string;
    presalePrice: number;
    usePresale: boolean;
}>;
