/**
 * 结算对账纯函数（买单券资金流 T5，三方口径：结算单 ↔ 分账回单 ↔ 商户核销流水）。
 * 全部为无 IO 纯函数：输入快照 → 差异列表，服务层负责取数与落表（可单测）。
 *
 * 对账口径：
 * - 账内平衡：faceAmount = commissionAmount + netAmount（风险铁律：金额必须自洽）
 * - 状态机一致性：SETTLED 必须有回执号且不长期滞留；PAID_OUT 必须有回执号且回执 FINISHED
 * - 单边缺失：核销流水无结算单（MISSING_SETTLEMENT，服务层 SQL 判定）/ 结算单无核销流水（MISSING_BILL）
 */

export type ReconcileDiffType =
    | 'AMOUNT_MISMATCH'
    | 'MISSING_RECEIPT'
    | 'RECEIPT_STATE_MISMATCH'
    | 'RECEIPT_QUERY_FAILED'
    | 'SETTLE_STUCK'
    | 'MISSING_SETTLEMENT'
    | 'MISSING_BILL';

export type ReconcileSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

/** 对账检查用的结算单快照（与实体字段解耦，纯函数只认快照） */
export interface SettlementSnapshot {
    id: number;
    settlementNo: string;
    status: string;
    splitReceiptNo: string | null;
    faceAmount: number;
    commissionAmount: number;
    netAmount: number;
    settledAt: Date | undefined;
    attempts: number;
    lastError: string | null;
    inStoreBillId: number | null;
}

/** 对账参数（服务层从环境变量解析后传入，默认值见 DEFAULT_RECONCILE_OPTS） */
export interface ReconcileOpts {
    /** PENDING 重试上限（与结算 job 同口径：COUPON_SETTLE_MAX_ATTEMPTS） */
    maxAttempts: number;
    /** SETTLED 滞留阈值（毫秒，超过视为卡单） */
    settledStuckMs: number;
}

export const DEFAULT_RECONCILE_OPTS: ReconcileOpts = {
    maxAttempts: 8,
    settledStuckMs: 24 * 60 * 60 * 1000,
};

export function resolveReconcileOpts(): ReconcileOpts {
    const max = Math.max(1, Math.floor(Number(process.env.COUPON_SETTLE_MAX_ATTEMPTS ?? 8)) || 8);
    const hours = Math.max(1, Math.floor(Number(process.env.COUPON_RECONCILE_STUCK_HOURS ?? 24)) || 24);
    return { maxAttempts: max, settledStuckMs: hours * 60 * 60 * 1000 };
}

export interface ReconcileDiffItem {
    settlementOrderId: number | null;
    settlementNo: string | null;
    diffType: ReconcileDiffType;
    severity: ReconcileSeverity;
    detail: Record<string, unknown>;
}

/** 单张结算单的账内 + 回执检查（纯函数核心，单测覆盖） */
export function computeSettlementDiffs(
    s: SettlementSnapshot,
    receipt: { state: 'PROCESSING' | 'FINISHED' | 'FAILED'; error?: string } | undefined,
    now: Date,
    opts: ReconcileOpts = DEFAULT_RECONCILE_OPTS,
): ReconcileDiffItem[] {
    // 终态（追偿/作废）不参与对账：REVERSED 走 T8 追偿链路、CANCELLED 是登记作废
    if (s.status === 'REVERSED' || s.status === 'CANCELLED') return [];
    const diffs: ReconcileDiffItem[] = [];
    const base = { settlementOrderId: s.id, settlementNo: s.settlementNo };

    // ① 账内金额平衡（HIGH：任何一环不平都是资损级）
    if (s.faceAmount !== s.commissionAmount + s.netAmount) {
        diffs.push({
            ...base,
            diffType: 'AMOUNT_MISMATCH',
            severity: 'HIGH',
            detail: { faceAmount: s.faceAmount, commissionAmount: s.commissionAmount, netAmount: s.netAmount },
        });
    }

    // ② 回执号存在性：已受理/已完成但无回执号 = 单边缺失
    if ((s.status === 'SETTLED' || s.status === 'PAID_OUT') && !s.splitReceiptNo) {
        diffs.push({ ...base, diffType: 'MISSING_RECEIPT', severity: 'HIGH', detail: { status: s.status } });
    }

    // ③ 回执状态一致性：本地已 PAID_OUT 但网关回执非 FINISHED
    if (s.status === 'PAID_OUT' && receipt && receipt.state !== 'FINISHED') {
        diffs.push({
            ...base,
            diffType: 'RECEIPT_STATE_MISMATCH',
            severity: 'HIGH',
            detail: { status: s.status, receiptState: receipt.state, receiptError: receipt.error ?? null },
        });
    }

    // ④ 结算卡单：
    //    - PENDING 重试耗尽仍待结算（重试队列死信）
    //    - SETTLED 受理后超阈值未推进（回执推进失联）
    if (s.status === 'PENDING' && s.attempts >= opts.maxAttempts) {
        diffs.push({
            ...base,
            diffType: 'SETTLE_STUCK',
            severity: 'MEDIUM',
            detail: { status: s.status, attempts: s.attempts, maxAttempts: opts.maxAttempts, lastError: s.lastError },
        });
    }
    if (s.status === 'SETTLED' && s.settledAt && now.getTime() - s.settledAt.getTime() > opts.settledStuckMs) {
        diffs.push({
            ...base,
            diffType: 'SETTLE_STUCK',
            severity: 'MEDIUM',
            detail: {
                status: s.status,
                settledAt: s.settledAt.toISOString(),
                stuckHours: Math.floor((now.getTime() - s.settledAt.getTime()) / 3600000),
                lastError: s.lastError,
            },
        });
    }

    return diffs;
}

/** 结算单缺核销流水（单边缺失：结算单指向的买单流水不存在） */
export function computeMissingBillDiff(s: SettlementSnapshot): ReconcileDiffItem | null {
    if (s.status === 'CANCELLED') return null;
    if (s.inStoreBillId == null) return null; // 历史兜底单允许无流水，不告警
    return {
        settlementOrderId: s.id,
        settlementNo: s.settlementNo,
        diffType: 'MISSING_BILL',
        severity: 'HIGH',
        detail: { inStoreBillId: s.inStoreBillId, status: s.status },
    };
}

/** 按严重度汇总（服务层返回值与台账页 KPI 用） */
export function summarizeSeverities(items: ReconcileDiffItem[]): { high: number; medium: number; low: number } {
    const acc = { high: 0, medium: 0, low: 0 };
    for (const d of items) {
        if (d.severity === 'HIGH') acc.high++;
        else if (d.severity === 'MEDIUM') acc.medium++;
        else acc.low++;
    }
    return acc;
}
