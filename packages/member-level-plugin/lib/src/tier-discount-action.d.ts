import { PromotionOrderAction } from '@vendure/core';
/**
 * 会员等级专属折扣动作（订单级）：配套 tierEligibleCondition，
 * 从 state 读当前档位 specialDiscountRate（千分比），按 subTotalWithTax 折让，
 * 并 clamp 到 subTotalWithTax。execute 返回负数折扣，促销框架应用。
 */
export declare const tierDiscountAction: PromotionOrderAction<{}, []>;
