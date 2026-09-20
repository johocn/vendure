import { CustomFieldConfig } from '@vendure/core';
/**
 * OrderLine custom fields：
 * - originalPrice: 原价（分），用于折扣展示与对账
 * - discount: 折扣百分比 100=原价 80=8 折，便于收银员改价
 * - memberPriceApplied: 是否已应用会员价
 * - isGift: 是否赠品（不参与金额计算）
 * - note: 行备注（如称重商品净重）
 * - originalOrderLineId: 退货行关联的原单行 ID
 * - giftRuleId: 买赠规则 ID（reapply 时按此清理旧 gift line，避免重复加）
 */
export declare const orderLineCustomFields: CustomFieldConfig[];
