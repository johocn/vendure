import { afterEach, describe, expect, it } from 'vitest';

import {
    computeMissingBillDiff,
    computeSettlementDiffs,
    DEFAULT_RECONCILE_OPTS,
    resolveReconcileOpts,
    SettlementSnapshot,
    summarizeSeverities,
} from './coupon-settlement-reconcile';

const NOW = new Date('2026-10-20T12:00:00+08:00');

function snap(overrides: Partial<SettlementSnapshot> = {}): SettlementSnapshot {
    return {
        id: 1,
        settlementNo: 'CSTL-7-1',
        status: 'PAID_OUT',
        splitReceiptNo: 'STUB-CSTL-7-1',
        faceAmount: 10000,
        commissionAmount: 0,
        netAmount: 10000,
        settledAt: new Date(NOW.getTime() - 3600_000),
        attempts: 1,
        lastError: null,
        inStoreBillId: 9,
        ...overrides,
    };
}

describe('computeSettlementDiffs 账内金额平衡', () => {
    it('face = commission + net → 无差异', () => {
        expect(computeSettlementDiffs(snap({ faceAmount: 10000, commissionAmount: 500, netAmount: 9500 }), undefined, NOW)).toEqual([]);
    });

    it('金额不平 → AMOUNT_MISMATCH HIGH（资损级）', () => {
        const diffs = computeSettlementDiffs(snap({ faceAmount: 10000, commissionAmount: 500, netAmount: 9000 }), undefined, NOW);
        expect(diffs).toHaveLength(1);
        expect(diffs[0].diffType).toBe('AMOUNT_MISMATCH');
        expect(diffs[0].severity).toBe('HIGH');
        expect(diffs[0].settlementNo).toBe('CSTL-7-1');
    });
});

describe('computeSettlementDiffs 回执存在性/一致性', () => {
    it('PAID_OUT 无回执号 → MISSING_RECEIPT HIGH', () => {
        const diffs = computeSettlementDiffs(snap({ splitReceiptNo: null }), undefined, NOW);
        expect(diffs.map(d => d.diffType)).toContain('MISSING_RECEIPT');
        expect(diffs.find(d => d.diffType === 'MISSING_RECEIPT')?.severity).toBe('HIGH');
    });

    it('PAID_OUT 但回执 PROCESSING → RECEIPT_STATE_MISMATCH HIGH', () => {
        const diffs = computeSettlementDiffs(snap(), { state: 'PROCESSING' }, NOW);
        expect(diffs.map(d => d.diffType)).toContain('RECEIPT_STATE_MISMATCH');
    });

    it('PAID_OUT 且回执 FINISHED → 无回执类差异', () => {
        expect(computeSettlementDiffs(snap(), { state: 'FINISHED' }, NOW)).toEqual([]);
    });

    it('PENDING 无回执号属正常（未受理），不报 MISSING_RECEIPT', () => {
        const diffs = computeSettlementDiffs(snap({ status: 'PENDING', splitReceiptNo: null, settledAt: undefined }), undefined, NOW);
        expect(diffs).toEqual([]);
    });
});

describe('computeSettlementDiffs 结算卡单', () => {
    it('PENDING 重试耗尽 → SETTLE_STUCK MEDIUM（带 lastError）', () => {
        const diffs = computeSettlementDiffs(
            snap({ status: 'PENDING', attempts: 8, lastError: 'gateway timeout', splitReceiptNo: null, settledAt: undefined }),
            undefined,
            NOW,
        );
        expect(diffs).toHaveLength(1);
        expect(diffs[0].diffType).toBe('SETTLE_STUCK');
        expect(diffs[0].severity).toBe('MEDIUM');
        expect(diffs[0].detail.lastError).toBe('gateway timeout');
    });

    it('PENDING 重试未耗尽 → 不报卡单', () => {
        expect(computeSettlementDiffs(snap({ status: 'PENDING', attempts: 2, splitReceiptNo: null, settledAt: undefined }), undefined, NOW)).toEqual([]);
    });

    it('SETTLED 滞留超阈值 → SETTLE_STUCK MEDIUM', () => {
        const settledAt = new Date(NOW.getTime() - 25 * 3600_000);
        const diffs = computeSettlementDiffs(snap({ status: 'SETTLED', settledAt }), undefined, NOW);
        expect(diffs).toHaveLength(1);
        expect(diffs[0].diffType).toBe('SETTLE_STUCK');
        expect(diffs[0].detail.stuckHours).toBe(25);
    });

    it('SETTLED 滞留未超阈值 → 不报', () => {
        const settledAt = new Date(NOW.getTime() - 2 * 3600_000);
        expect(computeSettlementDiffs(snap({ status: 'SETTLED', settledAt }), { state: 'PROCESSING' }, NOW)).toEqual([]);
    });
});

describe('computeSettlementDiffs 终态与查询异常', () => {
    it('REVERSED / CANCELLED 不参与对账', () => {
        expect(computeSettlementDiffs(snap({ status: 'REVERSED', splitReceiptNo: null, faceAmount: 1 }), undefined, NOW)).toEqual([]);
        expect(computeSettlementDiffs(snap({ status: 'CANCELLED', splitReceiptNo: null }), undefined, NOW)).toEqual([]);
    });
});

describe('computeMissingBillDiff 结算单缺核销流水', () => {
    it('有 inStoreBillId → MISSING_BILL HIGH', () => {
        const d = computeMissingBillDiff(snap());
        expect(d?.diffType).toBe('MISSING_BILL');
        expect(d?.severity).toBe('HIGH');
        expect(d?.detail.inStoreBillId).toBe(9);
    });

    it('历史兜底单（无 billId）与 CANCELLED 不报', () => {
        expect(computeMissingBillDiff(snap({ inStoreBillId: null }))).toBeNull();
        expect(computeMissingBillDiff(snap({ status: 'CANCELLED' }))).toBeNull();
    });
});

describe('summarizeSeverities 汇总', () => {
    it('按严重度计数', () => {
        const items = computeSettlementDiffs(
            snap({ faceAmount: 100, commissionAmount: 0, netAmount: 50, splitReceiptNo: null }),
            undefined,
            NOW,
        );
        expect(summarizeSeverities(items)).toEqual({ high: 2, medium: 0, low: 0 });
    });
});

describe('resolveReconcileOpts 环境解析', () => {
    const origA = process.env.COUPON_SETTLE_MAX_ATTEMPTS;
    const origH = process.env.COUPON_RECONCILE_STUCK_HOURS;

    afterEach(() => {
        if (origA === undefined) delete process.env.COUPON_SETTLE_MAX_ATTEMPTS;
        else process.env.COUPON_SETTLE_MAX_ATTEMPTS = origA;
        if (origH === undefined) delete process.env.COUPON_RECONCILE_STUCK_HOURS;
        else process.env.COUPON_RECONCILE_STUCK_HOURS = origH;
    });

    it('内建默认 24h / 8 次', () => {
        expect(DEFAULT_RECONCILE_OPTS).toEqual({ maxAttempts: 8, settledStuckMs: 24 * 3600_000 });
    });

    it('环境变量覆盖 + 非法值兜底', () => {
        process.env.COUPON_SETTLE_MAX_ATTEMPTS = '3';
        process.env.COUPON_RECONCILE_STUCK_HOURS = 'abc';
        const opts = resolveReconcileOpts();
        expect(opts.maxAttempts).toBe(3);
        expect(opts.settledStuckMs).toBe(24 * 3600_000);
    });
});
