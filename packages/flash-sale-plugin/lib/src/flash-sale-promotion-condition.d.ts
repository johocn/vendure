import { PromotionCondition } from '@vendure/core';
/**
 * 秒杀价条件：读 order.customFields.flashSaleActivityId，
 * 运行时查询活动并校验（active、窗口内、库存未售罄）后，
 * 返回 state `{ activityId, variantId, flashPrice }` 供 flash_sale_price 动作取价。
 *
 * 与阶段12/13 一致：活动配置运行时动态读取，无需在管理端按活动手工配 args。
 */
export declare const flashSaleDiscountCondition: PromotionCondition<{}, "flash_sale_discount", false | {
    activityId: string;
    variantId: string;
    flashPrice: number;
}>;
