import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { loggerCtx } from './constants';
import {
    computeMissingBillDiff,
    computeSettlementDiffs,
    ReconcileDiffItem,
    resolveReconcileOpts,
    SettlementSnapshot,
    summarizeSeverities,
} from './coupon-settlement-reconcile';
import { resolveSettlementAdapter, SplitReceiptResult } from './coupon-settlement-adapter';
import { CouponSettlementOrder } from './coupon-settlement-order.entity';
import { CouponSettlementReconcileDiff } from './coupon-settlement-reconcile-diff.entity';
import { InStoreBill } from './in-store-bill.entity';

/** 单轮对账扫描上限（与结算 job CYCLE_BATCH 同数量级，防一次性大事务） */
const RECONCILE_BATCH = 2000;
/** 单边缺失（缺结算单）差异落表上限：正常由结算 job 兜底补登自愈，超限只记汇总 */
const MISSING_SETTLEMENT_CAP = 100;

/** 对账轮次号：RCN-{channelId}-{yyyyMMddHHmmss} */
export function buildReconcileRunId(channelId: number, now: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(
        now.getMinutes(),
    )}${p(now.getSeconds())}`;
    return `RCN-${channelId}-${ts}`;
}

/**
 * 券结算对账服务（买单券资金流 T5）：
 * 三方口径 = 结算单（账内）↔ 分账回单（adapter.queryReceipt）↔ 商户核销流水（InStoreBill）。
 * - runReconcile：整渠道一轮对账，差异落 settlement_reconcile_diff；
 *   同渠道重跑先删上一轮未解决差异（对账语义 = 当前快照），resolved 记录保留审计。
 * - listDiffs / resolveDiff：台账页查询与人工核销差异。
 * 渠道隔离：与结算服务同口径，全部查询按 ctx.channelId 强制过滤。
 */
@Injectable()
export class CouponSettlementReconcileService {
    constructor(private connection: TransactionalConnection) {}

    /** 一轮对账（admin 手动触发；定时接入见 plugin.ts，与结算 job 同先例） */
    async runReconcile(ctx: RequestContext): Promise<{
        runId: string;
        checked: number;
        diffs: number;
        high: number;
        medium: number;
        low: number;
    }> {
        const channelId = Number(ctx.channelId);
        if (!Number.isFinite(channelId)) {
            throw new UserInputError('channel context required');
        }
        const runId = buildReconcileRunId(channelId, new Date());
        const opts = resolveReconcileOpts();
        const adapter = resolveSettlementAdapter();

        // ① 拉本渠道全部结算单（单轮上限内）
        const settleRepo = this.connection.rawConnection.getRepository(CouponSettlementOrder);
        const rows = await settleRepo.find({
            where: { channelId },
            order: { id: 'ASC' },
            take: RECONCILE_BATCH,
        });

        // ② 分账回单核对（仅 SETTLED/PAID_OUT 且有回执号；查询异常落 RECEIPT_QUERY_FAILED 差异，下轮重试）
        const receipts = new Map<number, SplitReceiptResult>();
        this.pendingQueryFailed.clear();
        for (const row of rows) {
            if ((row.status === 'SETTLED' || row.status === 'PAID_OUT') && row.splitReceiptNo) {
                const rid = Number(row.id);
                try {
                    receipts.set(rid, await adapter.queryReceipt(row.splitReceiptNo));
                } catch (e: any) {
                    // 查询失败与「回执 PROCESSING」语义不同：独立差异便于发现网关异常
                    this.pendingQueryFailed.set(rid, String(e?.message ?? e).slice(0, 500));
                }
            }
        }

        // ③ 账内 + 回执差异（纯函数）
        const items: ReconcileDiffItem[] = [];
        for (const row of rows) {
            const snap = toSnapshot(row);
            items.push(...computeSettlementDiffs(snap, receipts.get(Number(row.id)), new Date(), opts));
            if (this.pendingQueryFailed.has(Number(row.id))) {
                items.push({
                    settlementOrderId: Number(row.id),
                    settlementNo: row.settlementNo,
                    diffType: 'RECEIPT_QUERY_FAILED',
                    severity: 'LOW',
                    detail: { splitReceiptNo: row.splitReceiptNo, error: this.pendingQueryFailed.get(Number(row.id)) },
                });
            }
        }
        this.pendingQueryFailed.clear();

        // ④ 单边缺失：结算单有但核销流水无（HIGH，数据完整性问题）
        for (const row of rows) {
            const miss = computeMissingBillDiff(toSnapshot(row));
            if (miss) {
                const exists = await this.connection.rawConnection
                    .getRepository(InStoreBill)
                    .findOne({ where: { id: row.inStoreBillId as number } });
                if (!exists) items.push(miss);
            }
        }

        // ⑤ 单边缺失：核销流水有但结算单无（MEDIUM：结算 job 兜底补登会自愈，持续存在说明补登失败）
        //    与 backfillRegistrations 同查询口径：INNER JOIN 出售券（saleOrderId 非空）+ LEFT JOIN 结算单排除已登记
        const cutoff = this.settlementCutoff();
        const orphanBills = await this.connection.rawConnection
            .getRepository(InStoreBill)
            .createQueryBuilder('b')
            .select('b.id', 'billId')
            .addSelect('b.customerCouponId', 'customerCouponId')
            .addSelect('b.discountAmount', 'discountAmount')
            .addSelect('cc.saleOrderId', 'saleOrderId')
            .innerJoin('CustomerCoupon', 'cc', 'cc.id = b.customerCouponId AND cc.saleOrderId IS NOT NULL')
            .leftJoin(CouponSettlementOrder, 's', 's.customerCouponId = b.customerCouponId')
            .where('s.id IS NULL')
            .andWhere('b.billedAt < :cutoff', { cutoff })
            .orderBy('b.id', 'DESC')
            .take(MISSING_SETTLEMENT_CAP + 1)
            .getRawMany<{ billId: number | string; customerCouponId: number | string; discountAmount: number | string | null; saleOrderId: number | string | null }>();
        for (const b of orphanBills.slice(0, MISSING_SETTLEMENT_CAP)) {
            items.push({
                settlementOrderId: null,
                settlementNo: null,
                diffType: 'MISSING_SETTLEMENT',
                severity: 'MEDIUM',
                detail: {
                    inStoreBillId: Number(b.billId),
                    customerCouponId: Number(b.customerCouponId),
                    discountAmount: b.discountAmount == null ? null : Number(b.discountAmount),
                    saleOrderId: b.saleOrderId == null ? null : Number(b.saleOrderId),
                    note: 'next settlement cycle will backfill; persists if backfill keeps failing',
                },
            });
        }

        // ⑥ 落表：同渠道重跑覆盖上一轮未解决差异（对账 = 当前快照语义），resolved 记录保留
        const diffRepo = this.connection.getRepository(ctx, CouponSettlementReconcileDiff);
        await diffRepo
            .createQueryBuilder()
            .delete()
            .where('channelId = :channelId AND resolvedAt IS NULL', { channelId })
            .execute();
        if (items.length > 0) {
            await diffRepo.save(
                items.map(d =>
                    diffRepo.create({
                        runId,
                        channelId,
                        settlementOrderId: d.settlementOrderId,
                        settlementNo: d.settlementNo,
                        diffType: d.diffType,
                        severity: d.severity,
                        detail: JSON.stringify(d.detail),
                    }),
                ),
            );
        }

        const bySeverity = summarizeSeverities(items);
        Logger.info(
            `Settlement reconcile run ${runId}: checked=${rows.length} diffs=${items.length} high=${bySeverity.high} medium=${bySeverity.medium} low=${bySeverity.low}`,
            loggerCtx,
        );
        return { runId, checked: rows.length, diffs: items.length, ...bySeverity };
    }

    /** 台账页差异查询（渠道强制隔离；默认只看未解决） */
    async listDiffs(
        ctx: RequestContext,
        options?: { skip?: number; take?: number; severity?: string; diffType?: string; includeResolved?: boolean },
    ): Promise<{ items: CouponSettlementReconcileDiff[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, CouponSettlementReconcileDiff)
            .createQueryBuilder('d')
            .where('d.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (!options?.includeResolved) {
            qb.andWhere('d.resolvedAt IS NULL');
        }
        if (options?.severity) {
            qb.andWhere('d.severity = :severity', { severity: options.severity });
        }
        if (options?.diffType) {
            qb.andWhere('d.diffType = :diffType', { diffType: options.diffType });
        }
        qb.orderBy('d.id', 'DESC');
        qb.skip(Math.max(0, options?.skip ?? 0)).take(Math.min(options?.take ?? 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    /** 人工核销差异（处理完成后标记，保留审计） */
    async resolveDiff(ctx: RequestContext, id: number, remark?: string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, CouponSettlementReconcileDiff);
        const upd = await repo
            .createQueryBuilder()
            .update(CouponSettlementReconcileDiff)
            .set({ resolvedAt: new Date(), remark: remark?.slice(0, 200) ?? null })
            .where('id = :id AND channelId = :channelId AND resolvedAt IS NULL', {
                id,
                channelId: Number(ctx.channelId),
            })
            .execute();
        return (upd.affected ?? 0) > 0;
    }

    /** 临时容器：queryReceipt 异常跨两段传递（避免在 ②/③ 循环间重复结构） */
    private pendingQueryFailed = new Map<number, string>();

    /** T+1 界线：今天零点（与结算 job 同口径） */
    private settlementCutoff(): Date {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
}

function toSnapshot(row: CouponSettlementOrder): SettlementSnapshot {
    return {
        id: Number(row.id),
        settlementNo: row.settlementNo,
        status: row.status,
        splitReceiptNo: row.splitReceiptNo,
        faceAmount: row.faceAmount,
        commissionAmount: row.commissionAmount,
        netAmount: row.netAmount,
        settledAt: row.settledAt,
        attempts: row.attempts,
        lastError: row.lastError,
        inStoreBillId: row.inStoreBillId,
    };
}
