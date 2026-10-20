"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_settlement_reconcile_1 = require("./coupon-settlement-reconcile");
const NOW = new Date('2026-10-20T12:00:00+08:00');
function snap(overrides = {}) {
    return Object.assign({ id: 1, settlementNo: 'CSTL-7-1', status: 'PAID_OUT', splitReceiptNo: 'STUB-CSTL-7-1', faceAmount: 10000, commissionAmount: 0, netAmount: 10000, settledAt: new Date(NOW.getTime() - 3600000), attempts: 1, lastError: null, inStoreBillId: 9 }, overrides);
}
(0, vitest_1.describe)('computeSettlementDiffs 账内金额平衡', () => {
    (0, vitest_1.it)('face = commission + net → 无差异', () => {
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ faceAmount: 10000, commissionAmount: 500, netAmount: 9500 }), undefined, NOW)).toEqual([]);
    });
    (0, vitest_1.it)('金额不平 → AMOUNT_MISMATCH HIGH（资损级）', () => {
        const diffs = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ faceAmount: 10000, commissionAmount: 500, netAmount: 9000 }), undefined, NOW);
        (0, vitest_1.expect)(diffs).toHaveLength(1);
        (0, vitest_1.expect)(diffs[0].diffType).toBe('AMOUNT_MISMATCH');
        (0, vitest_1.expect)(diffs[0].severity).toBe('HIGH');
        (0, vitest_1.expect)(diffs[0].settlementNo).toBe('CSTL-7-1');
    });
});
(0, vitest_1.describe)('computeSettlementDiffs 回执存在性/一致性', () => {
    (0, vitest_1.it)('PAID_OUT 无回执号 → MISSING_RECEIPT HIGH', () => {
        var _a;
        const diffs = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ splitReceiptNo: null }), undefined, NOW);
        (0, vitest_1.expect)(diffs.map(d => d.diffType)).toContain('MISSING_RECEIPT');
        (0, vitest_1.expect)((_a = diffs.find(d => d.diffType === 'MISSING_RECEIPT')) === null || _a === void 0 ? void 0 : _a.severity).toBe('HIGH');
    });
    (0, vitest_1.it)('PAID_OUT 但回执 PROCESSING → RECEIPT_STATE_MISMATCH HIGH', () => {
        const diffs = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap(), { state: 'PROCESSING' }, NOW);
        (0, vitest_1.expect)(diffs.map(d => d.diffType)).toContain('RECEIPT_STATE_MISMATCH');
    });
    (0, vitest_1.it)('PAID_OUT 且回执 FINISHED → 无回执类差异', () => {
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap(), { state: 'FINISHED' }, NOW)).toEqual([]);
    });
    (0, vitest_1.it)('PENDING 无回执号属正常（未受理），不报 MISSING_RECEIPT', () => {
        const diffs = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'PENDING', splitReceiptNo: null, settledAt: undefined }), undefined, NOW);
        (0, vitest_1.expect)(diffs).toEqual([]);
    });
});
(0, vitest_1.describe)('computeSettlementDiffs 结算卡单', () => {
    (0, vitest_1.it)('PENDING 重试耗尽 → SETTLE_STUCK MEDIUM（带 lastError）', () => {
        const diffs = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'PENDING', attempts: 8, lastError: 'gateway timeout', splitReceiptNo: null, settledAt: undefined }), undefined, NOW);
        (0, vitest_1.expect)(diffs).toHaveLength(1);
        (0, vitest_1.expect)(diffs[0].diffType).toBe('SETTLE_STUCK');
        (0, vitest_1.expect)(diffs[0].severity).toBe('MEDIUM');
        (0, vitest_1.expect)(diffs[0].detail.lastError).toBe('gateway timeout');
    });
    (0, vitest_1.it)('PENDING 重试未耗尽 → 不报卡单', () => {
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'PENDING', attempts: 2, splitReceiptNo: null, settledAt: undefined }), undefined, NOW)).toEqual([]);
    });
    (0, vitest_1.it)('SETTLED 滞留超阈值 → SETTLE_STUCK MEDIUM', () => {
        const settledAt = new Date(NOW.getTime() - 25 * 3600000);
        const diffs = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'SETTLED', settledAt }), undefined, NOW);
        (0, vitest_1.expect)(diffs).toHaveLength(1);
        (0, vitest_1.expect)(diffs[0].diffType).toBe('SETTLE_STUCK');
        (0, vitest_1.expect)(diffs[0].detail.stuckHours).toBe(25);
    });
    (0, vitest_1.it)('SETTLED 滞留未超阈值 → 不报', () => {
        const settledAt = new Date(NOW.getTime() - 2 * 3600000);
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'SETTLED', settledAt }), { state: 'PROCESSING' }, NOW)).toEqual([]);
    });
});
(0, vitest_1.describe)('computeSettlementDiffs 终态与查询异常', () => {
    (0, vitest_1.it)('REVERSED / CANCELLED 不参与对账', () => {
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'REVERSED', splitReceiptNo: null, faceAmount: 1 }), undefined, NOW)).toEqual([]);
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ status: 'CANCELLED', splitReceiptNo: null }), undefined, NOW)).toEqual([]);
    });
});
(0, vitest_1.describe)('computeMissingBillDiff 结算单缺核销流水', () => {
    (0, vitest_1.it)('有 inStoreBillId → MISSING_BILL HIGH', () => {
        const d = (0, coupon_settlement_reconcile_1.computeMissingBillDiff)(snap());
        (0, vitest_1.expect)(d === null || d === void 0 ? void 0 : d.diffType).toBe('MISSING_BILL');
        (0, vitest_1.expect)(d === null || d === void 0 ? void 0 : d.severity).toBe('HIGH');
        (0, vitest_1.expect)(d === null || d === void 0 ? void 0 : d.detail.inStoreBillId).toBe(9);
    });
    (0, vitest_1.it)('历史兜底单（无 billId）与 CANCELLED 不报', () => {
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeMissingBillDiff)(snap({ inStoreBillId: null }))).toBeNull();
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.computeMissingBillDiff)(snap({ status: 'CANCELLED' }))).toBeNull();
    });
});
(0, vitest_1.describe)('summarizeSeverities 汇总', () => {
    (0, vitest_1.it)('按严重度计数', () => {
        const items = (0, coupon_settlement_reconcile_1.computeSettlementDiffs)(snap({ faceAmount: 100, commissionAmount: 0, netAmount: 50, splitReceiptNo: null }), undefined, NOW);
        (0, vitest_1.expect)((0, coupon_settlement_reconcile_1.summarizeSeverities)(items)).toEqual({ high: 2, medium: 0, low: 0 });
    });
});
(0, vitest_1.describe)('resolveReconcileOpts 环境解析', () => {
    const origA = process.env.COUPON_SETTLE_MAX_ATTEMPTS;
    const origH = process.env.COUPON_RECONCILE_STUCK_HOURS;
    (0, vitest_1.afterEach)(() => {
        if (origA === undefined)
            delete process.env.COUPON_SETTLE_MAX_ATTEMPTS;
        else
            process.env.COUPON_SETTLE_MAX_ATTEMPTS = origA;
        if (origH === undefined)
            delete process.env.COUPON_RECONCILE_STUCK_HOURS;
        else
            process.env.COUPON_RECONCILE_STUCK_HOURS = origH;
    });
    (0, vitest_1.it)('内建默认 24h / 8 次', () => {
        (0, vitest_1.expect)(coupon_settlement_reconcile_1.DEFAULT_RECONCILE_OPTS).toEqual({ maxAttempts: 8, settledStuckMs: 24 * 3600000 });
    });
    (0, vitest_1.it)('环境变量覆盖 + 非法值兜底', () => {
        process.env.COUPON_SETTLE_MAX_ATTEMPTS = '3';
        process.env.COUPON_RECONCILE_STUCK_HOURS = 'abc';
        const opts = (0, coupon_settlement_reconcile_1.resolveReconcileOpts)();
        (0, vitest_1.expect)(opts.maxAttempts).toBe(3);
        (0, vitest_1.expect)(opts.settledStuckMs).toBe(24 * 3600000);
    });
});
//# sourceMappingURL=coupon-settlement-reconcile.spec.js.map