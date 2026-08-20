import { PromotionOrderAction } from '@vendure/core';
/**
 * 积分抵现动作：配套 pointsRedeemCondition，读 state 中的 pointsRedeemAmount
 * 对订单整体折让（订单级折扣），并 clamp 到当前 subTotalWithTax，防止订单内容
 * 变更后抵扣金额超出实际商品总额。
 *
 * execute 返回负数折扣金额，由 PromotionOrderAction 框架应用到 Order。
 */
export declare const pointsRedeemAction: PromotionOrderAction<{}, []>;
