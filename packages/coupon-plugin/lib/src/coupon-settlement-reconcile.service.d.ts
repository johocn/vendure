import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CouponSettlementReconcileDiff } from './coupon-settlement-reconcile-diff.entity';
/** 对账轮次号：RCN-{channelId}-{yyyyMMddHHmmss} */
export declare function buildReconcileRunId(channelId: number, now: Date): string;
/**
 * 券结算对账服务（买单券资金流 T5）：
 * 三方口径 = 结算单（账内）↔ 分账回单（adapter.queryReceipt）↔ 商户核销流水（InStoreBill）。
 * - runReconcile：整渠道一轮对账，差异落 settlement_reconcile_diff；
 *   同渠道重跑先删上一轮未解决差异（对账语义 = 当前快照），resolved 记录保留审计。
 * - listDiffs / resolveDiff：台账页查询与人工核销差异。
 * 渠道隔离：与结算服务同口径，全部查询按 ctx.channelId 强制过滤。
 */
export declare class CouponSettlementReconcileService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 一轮对账（admin 手动触发；定时接入见 plugin.ts，与结算 job 同先例） */
    runReconcile(ctx: RequestContext): Promise<{
        runId: string;
        checked: number;
        diffs: number;
        high: number;
        medium: number;
        low: number;
    }>;
    /** 台账页差异查询（渠道强制隔离；默认只看未解决） */
    listDiffs(ctx: RequestContext, options?: {
        skip?: number;
        take?: number;
        severity?: string;
        diffType?: string;
        includeResolved?: boolean;
    }): Promise<{
        items: CouponSettlementReconcileDiff[];
        totalItems: number;
    }>;
    /** 人工核销差异（处理完成后标记，保留审计） */
    resolveDiff(ctx: RequestContext, id: number, remark?: string): Promise<boolean>;
    /** 临时容器：queryReceipt 异常跨两段传递（避免在 ②/③ 循环间重复结构） */
    private pendingQueryFailed;
    /** T+1 界线：今天零点（与结算 job 同口径） */
    private settlementCutoff;
}
