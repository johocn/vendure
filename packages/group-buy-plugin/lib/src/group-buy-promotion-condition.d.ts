import { PromotionCondition } from '@vendure/core';
import { GroupBuyDiscountConditionState } from './types';
/**
 * 拼团价条件：读 order.customFields.groupBuyActivityId，
 * 运行时查询活动并校验（非 expired、窗口内、订单含拼团变体行）后，
 * 返回 state `{ activityId, variantId, groupPrice }` 供 group_buy_price 动作取价。
 */
export declare const groupBuyDiscountCondition: PromotionCondition<{}, "group_buy_discount", false | GroupBuyDiscountConditionState>;
