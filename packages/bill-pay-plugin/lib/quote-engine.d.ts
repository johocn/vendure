import { BillPayChannelConfig, BillPayRule, isQuoteRejected, QuoteOutcome } from './types';
export { isQuoteRejected };
/**
 * 按规则报价。
 * - 金额非法（<=0）→ INVALID_AMOUNT；
 * - 低于 minAmount → BELOW_MIN（不接单）；
 * - 高于 maxAmount → ABOVE_MAX（转人工）；
 * - 会员折扣先按 percent 折算（四舍五入到分），满减档再对折扣后金额取最优档。
 */
export declare function quoteBill(expectedAmount: number, rule: BillPayRule): QuoteOutcome;
/**
 * 渠道配置解析（SSR 友好纯函数）：坏 JSON / 缺字段逐字段回退默认值，
 * 对齐项目 detail-config 的「坏配置返回默认、不抛错」模式。
 */
export declare function parseBillPayConfig(raw: unknown): BillPayChannelConfig;
