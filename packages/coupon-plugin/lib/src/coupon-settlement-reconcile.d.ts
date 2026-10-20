/**
 * 结算对账纯函数（买单券资金流 T5，三方口径：结算单 ↔ 分账回单 ↔ 商户核销流水）。
 * 全部为无 IO 纯函数：输入快照 → 差异列表，服务层负责取数与落表（可单测）。
 *
 * 对账口径：
 * - 账内平衡：faceAmount = commissionAmount + netAmount（风险铁律：金额必须自洽）
 * - 状态机一致性：SETTLED 必须有回执号且不长期滞留；PAID_OUT 必须有回执号且回执 FINISHED
 * - 单边缺失：核销流水无结算单（MISSING_SETTLEMENT，服务层 SQL 判定）/ 结算单无核销流水（MISSING_BILL）
 */
export type ReconcileDiffType = 'AMOUNT_MISMATCH' | 'MISSING_RECEIPT' | 'RECEIPT_STATE_MISMATCH' | 'RECEIPT_QUERY_FAILED' | 'SETTLE_STUCK' | 'MISSING_SETTLEMENT' | 'MISSING_BILL';
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
export declare const DEFAULT_RECONCILE_OPTS: ReconcileOpts;
export declare function resolveReconcileOpts(): ReconcileOpts;
export interface ReconcileDiffItem {
    settlementOrderId: number | null;
    settlementNo: string | null;
    diffType: ReconcileDiffType;
    severity: ReconcileSeverity;
    detail: Record<string, unknown>;
}
/** 单张结算单的账内 + 回执检查（纯函数核心，单测覆盖） */
export declare function computeSettlementDiffs(s: SettlementSnapshot, receipt: {
    state: 'PROCESSING' | 'FINISHED' | 'FAILED';
    error?: string;
} | undefined, now: Date, opts?: ReconcileOpts): ReconcileDiffItem[];
/** 结算单缺核销流水（单边缺失：结算单指向的买单流水不存在） */
export declare function computeMissingBillDiff(s: SettlementSnapshot): ReconcileDiffItem | null;
/** 按严重度汇总（服务层返回值与台账页 KPI 用） */
export declare function summarizeSeverities(items: ReconcileDiffItem[]): {
    high: number;
    medium: number;
    low: number;
};
