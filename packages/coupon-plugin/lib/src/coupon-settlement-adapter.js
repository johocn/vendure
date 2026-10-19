"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSettlementAdapter = resolveSettlementAdapter;
exports.computeSettlementAmounts = computeSettlementAmounts;
exports.buildSettlementNo = buildSettlementNo;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * stub 适配器：本地闭环模拟，受理即返回确定性回执号、回执即 FINISHED。
 * 不产生任何真实资金动作；生产可开（结算单留痕、状态机真实流转），便于对账演练。
 */
class StubSettlementAdapter {
    constructor() {
        this.mode = 'stub';
    }
    async submitSplit(order, idempotencyKey) {
        return { accepted: true, receiptNo: `STUB-${idempotencyKey}` };
    }
    async queryReceipt(receiptNo) {
        return { state: 'FINISHED' };
    }
    async refundSplit(order, reason) {
        return { accepted: true, receiptNo: `STUB-REV-${order.settlementNo}` };
    }
}
/**
 * 按环境变量 COUPON_SPLIT_MODE 解析适配器：
 * - 'stub'（默认）：stub 模拟
 * - 'wechat'：微信分账实联 —— P0 未持合规书面结论前明确拒绝（宁可结算单留在重试队列，
 *   也不静默回落 stub 造成「假分账成功」的账实不符）。
 */
function resolveSettlementAdapter() {
    var _a;
    const mode = ((_a = process.env.COUPON_SPLIT_MODE) !== null && _a !== void 0 ? _a : 'stub').trim().toLowerCase();
    if (mode === 'wechat') {
        throw new Error('COUPON_SPLIT_MODE=wechat requires written compliance approval (Q3.1/Q3.2) and the wechat split implementation; keep SPLIT_MODE=stub for now');
    }
    if (mode !== 'stub') {
        core_1.Logger.warn(`Unknown COUPON_SPLIT_MODE=${mode}, falling back to stub`, constants_1.loggerCtx);
    }
    return new StubSettlementAdapter();
}
/** 佣金/净付额计算（纯函数，供结算登记与单测共用）：费率万分比，佣金额向下取整分 */
function computeSettlementAmounts(faceAmount, commissionRateBp) {
    const face = Math.max(0, Math.floor(Number(faceAmount) || 0));
    const bp = Math.max(0, Math.floor(Number(commissionRateBp) || 0));
    const commissionAmount = Math.floor((face * bp) / 10000);
    return { commissionAmount, netAmount: face - commissionAmount };
}
/** 结算单号（确定性生成；customerCouponId 唯一 ⇒ 单号唯一） */
function buildSettlementNo(channelId, customerCouponId) {
    return `CSTL-${channelId}-${customerCouponId}`;
}
//# sourceMappingURL=coupon-settlement-adapter.js.map