import { Injectable, Logger as NestLogger } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { In } from 'typeorm';

import { loggerCtx } from './constants';
import {
    buildSettlementNo,
    computeSettlementAmounts,
    resolveSettlementAdapter,
    SettlementAdapter,
} from './coupon-settlement-adapter';
import { CouponSettlementOrder } from './coupon-settlement-order.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { InStoreBill } from './in-store-bill.entity';

/** 汇总出单上限（单次循环处理条数，防止一次性大事务） */
const CYCLE_BATCH = 200;

/**
 * 券结算服务（买单券资金流 T1/T3 编排）：
 * - registerFromBill：核销（到店买单）成功后同步登记待结算单（幂等，失败不阻断核销）
 * - runSettlementCycle：T+1 汇总 job——① 兜底补登（唯一约束防重复出单）
 *   ② 提交分账（幂等键 = 结算单号，带原状态条件原子更新，风险铁律④）③ 回执推进
 * P0 结算口径：仅到店核销（InStoreBill）登记结算——线上订单核销的面额折算需订单级折扣捕获，
 * 与退款联动（T8）一并列入后续任务；线上券继续走原有订单资金流，不受本服务影响。
 */
@Injectable()
export class CouponSettlementService {
    constructor(private connection: TransactionalConnection) {}

    /** 佣金费率快照来源：环境变量 COUPON_SPLIT_COMMISSION_BP（万分比，默认 0 = 平台暂不分佣） */
    private commissionRateBp(): number {
        const v = Math.floor(Number(process.env.COUPON_SPLIT_COMMISSION_BP ?? 0));
        return Number.isFinite(v) && v > 0 ? v : 0;
    }

    /** T+1 界线：今天零点（核销发生在今天零点之前 = 已满一天，可提交分账） */
    private settlementCutoff(): Date {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    /**
     * 核销 → 待结算登记（幂等：customerCouponId 唯一约束）。
     * 在核销事务内调用；任何失败只记日志不抛错——核销是主流程，结算登记由 T+1 job 兜底补登。
     */
    async registerFromBill(
        ctx: RequestContext,
        bill: InStoreBill,
        saleOrderId?: number | null,
    ): Promise<void> {
        try {
            const repo = this.connection.getRepository(ctx, CouponSettlementOrder);
            const faceAmount = Math.max(0, Math.floor(Number(bill.discountAmount) || 0));
            const commissionRateBp = this.commissionRateBp();
            const { commissionAmount, netAmount } = computeSettlementAmounts(faceAmount, commissionRateBp);
            const row = new CouponSettlementOrder({
                channelId: bill.channelId as number,
                saleOrderId: saleOrderId ?? null,
                customerCouponId: bill.customerCouponId,
                templateId: bill.couponTemplateId,
                redeemRef: `BILL:${bill.id}`,
                inStoreBillId: bill.id as number,
                faceAmount,
                commissionRateBp,
                commissionAmount,
                netAmount,
                status: 'PENDING',
                settlementNo: buildSettlementNo(bill.channelId as number, bill.customerCouponId),
                attempts: 0,
                voucherType: '601',
                remark: null,
            });
            await repo.save(row);
        } catch (e: any) {
            // 唯一约束冲突 = 已登记（重复核销回调/幂等重放），静默；其余错误记日志待 job 补登
            const msg = String(e?.message ?? e);
            if (!/unique|duplicate|UNIQUE/i.test(msg)) {
                Logger.error(
                    `Settlement registration failed for bill ${bill.id}: ${msg} (job will backfill)`,
                    loggerCtx,
                );
            }
        }
    }

    /** T+1 汇总出单 + 提交分账 + 回执推进（供定时任务与 admin 手动触发共用；ctx 仅用于鉴权） */
    async runSettlementCycle(): Promise<{ submitted: number; promoted: number; failed: number }> {
        const adapter = resolveSettlementAdapter();
        const backfilled = await this.backfillRegistrations();
        const submitted = await this.submitDueRows(adapter);
        const { promoted, failed } = await this.promoteSettledRows(adapter);
        if (backfilled > 0 || submitted > 0 || promoted > 0) {
            Logger.info(
                `Settlement cycle: backfill=${backfilled} submitted=${submitted} promoted=${promoted} failed=${failed}`,
                loggerCtx,
            );
        }
        return { submitted, promoted, failed };
    }

    /**
     * 兜底补登：核销成功但登记缺失（历史数据/登记异常）的到店买单 → 补 PENDING 结算单。
     * 查询条件全部下推 SQL（风险铁律②）：INNER JOIN 用户券限 saleOrderId 非空（只有出售券涉及分账），
     * LEFT JOIN 结算单排除已登记；日期用 TypeORM 参数绑定（Date 对象，驱动负责序列化，
     * SQLite/PG 口径一致——不做字符串手工比较，规避超时关单 e2e 的日期序列化前科）。
     */
    private async backfillRegistrations(): Promise<number> {
        const billRepo = this.connection.rawConnection.getRepository(InStoreBill);
        const settleRepo = this.connection.rawConnection.getRepository(CouponSettlementOrder);
        const rows = await billRepo
            .createQueryBuilder('b')
            .select('b.id', 'billId')
            .addSelect('b.channelId', 'channelId')
            .addSelect('b.customerCouponId', 'customerCouponId')
            .addSelect('b.couponTemplateId', 'couponTemplateId')
            .addSelect('b.discountAmount', 'discountAmount')
            .addSelect('cc.saleOrderId', 'saleOrderId')
            .innerJoin(CustomerCoupon, 'cc', 'cc.id = b.customerCouponId AND cc.saleOrderId IS NOT NULL')
            .leftJoin(CouponSettlementOrder, 's', 's.customerCouponId = b.customerCouponId')
            .where('s.id IS NULL')
            .andWhere('b.billedAt < :cutoff', { cutoff: this.settlementCutoff() })
            .orderBy('b.id', 'DESC')
            .take(CYCLE_BATCH)
            .getRawMany<{
                billId: number | string;
                channelId: number | string;
                customerCouponId: number | string;
                couponTemplateId: number | string | null;
                discountAmount: number | string | null;
                saleOrderId: number | string | null;
            }>();
        let n = 0;
        for (const r of rows) {
            const billId = Number(r.billId);
            const channelId = Number(r.channelId);
            const customerCouponId = Number(r.customerCouponId);
            try {
                const faceAmount = Math.max(0, Math.floor(Number(r.discountAmount) || 0));
                const commissionRateBp = this.commissionRateBp();
                const { commissionAmount, netAmount } = computeSettlementAmounts(faceAmount, commissionRateBp);
                await settleRepo.save(
                    new CouponSettlementOrder({
                        channelId,
                        saleOrderId: r.saleOrderId == null ? null : Number(r.saleOrderId),
                        customerCouponId,
                        templateId: r.couponTemplateId == null ? null : Number(r.couponTemplateId),
                        redeemRef: `BILL:${billId}`,
                        inStoreBillId: billId,
                        faceAmount,
                        commissionRateBp,
                        commissionAmount,
                        netAmount,
                        status: 'PENDING',
                        settlementNo: buildSettlementNo(channelId, customerCouponId),
                        attempts: 0,
                        voucherType: '601',
                    }),
                );
                n++;
            } catch (e: any) {
                if (!/unique|duplicate|UNIQUE/i.test(String(e?.message ?? e))) {
                    Logger.error(
                        `Settlement backfill insert failed (bill ${billId}, coupon ${customerCouponId}): ${e?.message}`,
                        loggerCtx,
                    );
                }
            }
        }
        return n;
    }

    /**
     * 提交到期 PENDING 结算单（SQL 下推：status + T+1 界线 + 重试上限）。
     * 幂等：① submitSplit 幂等键 = 结算单号 ② 状态推进全部带原状态条件原子更新。
     */
    private async submitDueRows(adapter: SettlementAdapter): Promise<number> {
        const repo = this.connection.rawConnection.getRepository(CouponSettlementOrder);
        const due = await repo
            .createQueryBuilder('s')
            .where('s.status = :status', { status: 'PENDING' })
            .andWhere('s.attempts < :max', {
                max: Math.max(1, Math.floor(Number(process.env.COUPON_SETTLE_MAX_ATTEMPTS ?? 8))),
            })
            .andWhere('s.createdAt < :cutoff', { cutoff: this.settlementCutoff() })
            .orderBy('s.id', 'ASC')
            .take(CYCLE_BATCH)
            .getMany();
        let submitted = 0;
        for (const row of due) {
            // 抢占：带原状态条件原子累加重试次数（并发双跑时受 settlementNo 幂等保护）
            const claim = await repo
                .createQueryBuilder()
                .update(CouponSettlementOrder)
                .set({ attempts: () => 'attempts + 1' })
                .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                .execute();
            if ((claim.affected ?? 0) === 0) continue;
            try {
                const res = await adapter.submitSplit(row, row.settlementNo);
                if (res.accepted) {
                    await repo
                        .createQueryBuilder()
                        .update(CouponSettlementOrder)
                        .set({
                            status: 'SETTLED',
                            settledAt: new Date(),
                            splitReceiptNo: res.receiptNo ?? null,
                            splitMode: adapter.mode,
                            lastError: null,
                        })
                        .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                        .execute();
                    submitted++;
                } else {
                    await repo
                        .createQueryBuilder()
                        .update(CouponSettlementOrder)
                        .set({ lastError: res.error ?? 'split submit rejected' })
                        .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                        .execute();
                }
            } catch (e: any) {
                // 失败留在 PENDING（attempts 已累加）等待下轮重试
                await repo
                    .createQueryBuilder()
                    .update(CouponSettlementOrder)
                    .set({ lastError: String(e?.message ?? e).slice(0, 2000) })
                    .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                    .execute()
                    .catch(() => undefined);
            }
        }
        return submitted;
    }

    /** 回执推进：SETTLED → PAID_OUT（FINISHED）/ 退回 PENDING 重试（FAILED） */
    private async promoteSettledRows(
        adapter: SettlementAdapter,
    ): Promise<{ promoted: number; failed: number }> {
        const repo = this.connection.rawConnection.getRepository(CouponSettlementOrder);
        const rows = await repo.find({ where: { status: 'SETTLED' }, order: { id: 'ASC' }, take: CYCLE_BATCH });
        let promoted = 0;
        let failed = 0;
        for (const row of rows) {
            if (!row.splitReceiptNo) continue;
            try {
                const receipt = await adapter.queryReceipt(row.splitReceiptNo);
                if (receipt.state === 'FINISHED') {
                    const upd = await repo
                        .createQueryBuilder()
                        .update(CouponSettlementOrder)
                        .set({ status: 'PAID_OUT', paidOutAt: new Date(), lastError: null })
                        .where('id = :id AND status = :status', { id: row.id, status: 'SETTLED' })
                        .execute();
                    if ((upd.affected ?? 0) > 0) promoted++;
                } else if (receipt.state === 'FAILED') {
                    const upd = await repo
                        .createQueryBuilder()
                        .update(CouponSettlementOrder)
                        .set({ status: 'PENDING', lastError: receipt.error ?? 'split receipt FAILED' })
                        .where('id = :id AND status = :status', { id: row.id, status: 'SETTLED' })
                        .execute();
                    if ((upd.affected ?? 0) > 0) failed++;
                }
            } catch (e: any) {
                NestLogger.error?.(`[CouponSettlement] receipt query failed for ${row.settlementNo}: ${e?.message}`);
            }
        }
        return { promoted, failed };
    }

    /** admin 流水查询（渠道强制隔离） */
    async listSettlements(
        ctx: RequestContext,
        options?: { skip?: number; take?: number; status?: string },
    ): Promise<{ items: CouponSettlementOrder[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, CouponSettlementOrder)
            .createQueryBuilder('s')
            .where('s.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (options?.status) {
            qb.andWhere('s.status = :status', { status: options.status });
        }
        qb.orderBy('s.id', 'DESC');
        qb.skip(Math.max(0, options?.skip ?? 0)).take(Math.min(options?.take ?? 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findSettlement(ctx: RequestContext, id: number): Promise<CouponSettlementOrder | undefined> {
        return (
            (await this.connection.getRepository(ctx, CouponSettlementOrder).findOne({
                where: { id, channelId: ctx.channelId as any },
            })) ?? undefined
        );
    }

    /** admin 手动触发（运维入口；鉴权在 resolver） */
    async manualRunCycle(ctx: RequestContext): Promise<{ submitted: number; promoted: number; failed: number }> {
        if (ctx.channelId == null) {
            throw new UserInputError('channel context required');
        }
        return this.runSettlementCycle();
    }

    /** 供退款联动（T8）预留的批量查询工具 */
    async findSettlementsBySaleOrder(ctx: RequestContext, saleOrderIds: number[]): Promise<CouponSettlementOrder[]> {
        if (saleOrderIds.length === 0) return [];
        return this.connection.getRepository(ctx, CouponSettlementOrder).find({ where: { saleOrderId: In(saleOrderIds) } });
    }

    /**
     * 退款联动（T8）：出售单退款成功后调用——
     * - 结算单 PENDING（未提交分账）→ CANCELLED（取消登记；原子更新带原状态条件，风险铁律④）
     * - SETTLED / PAID_OUT（已提交/完成分账）→ adapter.refundSplit 追偿，受理后 → REVERSED
     * 在退款主事务 commit 之后调用；任何失败只记日志不抛错（不阻断退款主流程，
     * 漏网单据由 T5 对账的 MISSING/STUCK 口径兜底暴露）。
     */
    async onSaleOrderRefunded(
        ctx: RequestContext,
        saleOrderId: number,
        reason?: string,
    ): Promise<{ cancelled: number; reversed: number; failed: number }> {
        const result = { cancelled: 0, reversed: 0, failed: 0 };
        try {
            const rows = await this.findSettlementsBySaleOrder(ctx, [saleOrderId]);
            if (rows.length === 0) return result;
            const repo = this.connection.rawConnection.getRepository(CouponSettlementOrder);
            const adapter = resolveSettlementAdapter();
            for (const row of rows) {
                try {
                    if (row.status === 'PENDING') {
                        const upd = await repo
                            .createQueryBuilder()
                            .update(CouponSettlementOrder)
                            .set({ status: 'CANCELLED', remark: (reason ?? 'sale order refunded').slice(0, 200) })
                            .where('id = :id AND status = :status', { id: row.id, status: 'PENDING' })
                            .execute();
                        if ((upd.affected ?? 0) > 0) result.cancelled++;
                    } else if (row.status === 'SETTLED' || row.status === 'PAID_OUT') {
                        const sub = await adapter.refundSplit(row, reason);
                        if (!sub.accepted) {
                            result.failed++;
                            Logger.error(`Refund split rejected for ${row.settlementNo}: ${sub.error ?? 'unknown'}`, loggerCtx);
                            continue;
                        }
                        const upd = await repo
                            .createQueryBuilder()
                            .update(CouponSettlementOrder)
                            .set({
                                status: 'REVERSED',
                                reversedAt: new Date(),
                                remark: `refund receipt ${sub.receiptNo ?? '-'}`.slice(0, 200),
                            })
                            .where('id = :id AND status IN (:...st)', { id: row.id, st: ['SETTLED', 'PAID_OUT'] })
                            .execute();
                        if ((upd.affected ?? 0) > 0) result.reversed++;
                        else result.failed++;
                    }
                } catch (e: any) {
                    result.failed++;
                    Logger.error(`Settlement refund linkage failed for ${row.settlementNo}: ${e?.message}`, loggerCtx);
                }
            }
            if (result.cancelled || result.reversed || result.failed) {
                Logger.info(
                    `Settlement refund linkage (sale order ${saleOrderId}): cancelled=${result.cancelled} reversed=${result.reversed} failed=${result.failed}`,
                    loggerCtx,
                );
            }
        } catch (e: any) {
            Logger.error(`Settlement refund linkage query failed (sale order ${saleOrderId}): ${e?.message}`, loggerCtx);
        }
        return result;
    }

    /** 结算汇总（T11 看板口径 = 结算单聚合；渠道强制隔离，金额单位分） */
    async settlementSummary(ctx: RequestContext): Promise<{
        total: number;
        pending: number;
        settled: number;
        paidOut: number;
        reversed: number;
        cancelled: number;
        totalFace: number;
        totalCommission: number;
        totalNet: number;
    }> {
        const rows = await this.connection
            .getRepository(ctx, CouponSettlementOrder)
            .createQueryBuilder('s')
            .select('s.status', 'status')
            .addSelect('COUNT(*)', 'cnt')
            .addSelect('COALESCE(SUM(s.faceAmount), 0)', 'face')
            .addSelect('COALESCE(SUM(s.commissionAmount), 0)', 'commission')
            .addSelect('COALESCE(SUM(s.netAmount), 0)', 'net')
            .where('s.channelId = :channelId', { channelId: Number(ctx.channelId) })
            .groupBy('s.status')
            .getRawMany<{ status: string; cnt: string; face: string; commission: string; net: string }>();
        const summary = {
            total: 0,
            pending: 0,
            settled: 0,
            paidOut: 0,
            reversed: 0,
            cancelled: 0,
            totalFace: 0,
            totalCommission: 0,
            totalNet: 0,
        };
        for (const r of rows) {
            const cnt = Number(r.cnt);
            summary.total += cnt;
            summary.totalFace += Number(r.face);
            summary.totalCommission += Number(r.commission);
            summary.totalNet += Number(r.net);
            if (r.status === 'PENDING') summary.pending = cnt;
            else if (r.status === 'SETTLED') summary.settled = cnt;
            else if (r.status === 'PAID_OUT') summary.paidOut = cnt;
            else if (r.status === 'REVERSED') summary.reversed = cnt;
            else if (r.status === 'CANCELLED') summary.cancelled = cnt;
        }
        return summary;
    }
}
