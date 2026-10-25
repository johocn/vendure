import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, RequestContextService, TransactionalConnection, UserInputError } from '@vendure/core';
import { LessThan } from 'typeorm';
import { getCouponBalancePort } from '@vendure/coupon-plugin';
import { BalanceTransaction } from '@vendure/recharge-card-plugin';
import { RiderEarning } from './rider-earning.entity';
import { RiderService } from './rider.service';
import { RiderWithdrawalRequest } from './rider-withdrawal.entity';

const MIN_WITHDRAW_AMOUNT = 1000; // 最低提现 ¥10（分）

/** 骑手钱包：余额底座复用 coupon-balance-port（recharge-card CustomerBalance）。
 * 提现即扣减余额（冻结语义：frozen = PENDING 申请合计），驳回退回、打款仅留痕。
 * 骑手为平台级能力：资金操作与流水的渠道上下文固定为默认渠道（platformCtx），
 * 不随调用方（骑手端无渠道头、管理端选店）的 channelToken 漂移。 */
@Injectable()
export class RiderWalletService {
    constructor(
        private connection: TransactionalConnection,
        private riderService: RiderService,
        private requestContextService: RequestContextService,
    ) {}

    /** 默认渠道上下文：余额端口与提现记录统一在此渠道下读写 */
    private async platformCtx(): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin' });
    }

    async myRiderWallet(ctx: RequestContext) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        await this.settlePendingEarnings(pc, rider.id as number);
        const port = getCouponBalancePort();
        const available = port ? await port.getBalance(pc, rider.id as number) : 0;
        const frozen = await this.sumPending(pc, rider.id as number);
        const totalEarned = await this.sumEarned(pc, rider.id as number);
        return { available, frozen, totalEarned };
    }

    /** 分成入账失败的自愈补账：deliver 落 pending 后入账失败/未注册端口的记录，读取钱包时重试入账。
     * 防重复入账（P1）：先按行 CAS 认领（pending/超时 crediting → crediting）成功的进程才入账，
     * 入账成功置 credited、失败回 pending；崩溃残留在 crediting 的行超过 10 分钟也重新认领（避免永久卡款）。
     * 残余风险：入账成功但进程在置 credited 前崩溃 → 10 分钟后会被再次入账，仅能靠日志人工对账。 */
    private async settlePendingEarnings(pc: RequestContext, riderCustomerId: number): Promise<void> {
        const port = getCouponBalancePort();
        if (!port) return;
        const repo = this.connection.getRepository(pc, RiderEarning);
        // 超过 10 分钟仍停留在 crediting = 上次入账链路中断，重新纳入补账
        const staleBefore = new Date(Date.now() - 10 * 60_000);
        const pending = await repo.find({
            where: { riderCustomerId, status: 'pending' } as any,
            take: 50,
        });
        const stale = await repo.find({
            where: { riderCustomerId, status: 'crediting', updatedAt: LessThan(staleBefore) } as any,
            take: 50,
        });
        for (const row of [...pending, ...stale]) {
            try {
                // 行级认领：并发读钱包（多端/多进程）只有一个能拿到该行
                const claimed: any = await this.connection.rawConnection.query(
                    'UPDATE rider_earning SET status = $1, "updatedAt" = now() '
                    + 'WHERE id = $2 AND status = $3 RETURNING id',
                    ['crediting', row.id, row.status],
                );
                const rows = Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed;
                if (!Array.isArray(rows) || !rows.length) continue; // 另一路已认领
                await port.addBalance(pc, riderCustomerId, row.amount);
                await repo.update(row.id, { status: 'credited' } as any);
                Logger.warn(`补账成功：earning ${row.id}（${row.amount} 分）`, 'RiderWallet');
            } catch (e: any) {
                // 入账失败回 pending 供下次重试（crediting 会让该行等待 10 分钟才可重试）
                await repo.update(row.id, { status: 'pending' } as any).catch(() => undefined);
                Logger.error(`补账失败：earning ${row.id}：${e?.message ?? e}`, 'RiderWallet');
                break; // 余额端口异常时停止本轮，避免逐条打错误
            }
        }
    }

    /** 余额流水（recharge-card BalanceTransaction，默认渠道本人倒序） */
    async riderBalanceHistory(ctx: RequestContext, skip?: number, take?: number) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        const safeSkip = Math.max(0, skip ?? 0);
        const safeTake = Math.min(Math.max(take ?? 20, 1), 200);
        return this.connection
            .getRepository(pc, BalanceTransaction)
            .createQueryBuilder('tx')
            .where('tx.customerId = :id', { id: rider.id })
            .andWhere('tx.channelId = :ch', { ch: pc.channelId })
            .orderBy('tx.createdAt', 'DESC')
            .skip(safeSkip)
            .take(safeTake)
            .getMany();
    }

    /** 本人提现申请记录（平台级，倒序） */
    async riderWithdrawRequests(ctx: RequestContext, skip?: number, take?: number) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        const safeSkip = Math.max(0, skip ?? 0);
        const safeTake = Math.min(Math.max(take ?? 20, 1), 200);
        return this.connection
            .getRepository(pc, RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .where('w.customerId = :id', { id: rider.id })
            .orderBy('w.createdAt', 'DESC')
            .skip(safeSkip)
            .take(safeTake)
            .getMany();
    }

    /** 提现申请：校验骑手 + ≥¥10 + 无在途申请 + ≤可提现 → 扣款冻结 → PENDING 申请 */
    async riderWithdraw(ctx: RequestContext, input: { amount: number; channel: string; account: string }) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const amount = Math.floor(input.amount);
        if (!amount || amount < MIN_WITHDRAW_AMOUNT) throw new UserInputError('最低提现金额为 ¥10');
        if (!input.channel?.trim()) throw new UserInputError('请选择收款渠道');
        if (!input.account?.trim()) throw new UserInputError('请填写收款账号');
        // 入参长度上限：账号/渠道名会原样落库并展示给审核人，防超长文本
        const channelText = input.channel.trim();
        const accountText = input.account.trim();
        if (channelText.length > 30) throw new UserInputError('收款渠道名称过长');
        if (accountText.length > 100) throw new UserInputError('收款账号过长');
        const pc = await this.platformCtx();
        const port = getCouponBalancePort();
        if (!port) throw new UserInputError('余额功能未开通');
        // F2 并发防重：余额端口的 add/deduct 自带事务提交（startTransaction+commitOpenTransaction），
        // 不能与外层事务同 ctx 嵌套，故用 rawConnection 独立事务 + Customer 行悲观锁把
        // 「防重检查→余额校验→扣款→落库」对同骑手串行化：并发双请求只有一个能通过 PENDING 检查。
        // 残余风险（与历史一致且窗口极小）：扣款成功后 raw 事务提交失败 → 已扣无单，需人工对账。
        return this.connection.rawConnection.transaction(async (em) => {
            // 裸 SQL 行锁：Customer 实体 findOne+lock 会 LEFT JOIN channels 等关联表，
            // PG 拒绝对外连接可空侧 FOR UPDATE，故用单表 SELECT ... FOR UPDATE
            await em.query('SELECT id FROM customer WHERE id = $1 FOR UPDATE', [rider.id]);
            const pending = await em.getRepository(RiderWithdrawalRequest).count({
                where: { customerId: rider.id as number, status: 'PENDING' },
            });
            if (pending > 0) throw new UserInputError('您有审核中的提现申请，请等待审核完成');
            const available = await port.getBalance(pc, rider.id as number);
            if (amount > available) throw new UserInputError('超过可提现余额');
            await port.deductBalance(pc, rider.id as number, amount);
            return em.getRepository(RiderWithdrawalRequest).save({
                customerId: rider.id,
                channelId: pc.channelId,
                amount,
                channel: channelText,
                account: accountText,
                status: 'PENDING',
            } as any);
        });
    }

    /** 管理端：提现申请列表（status=ALL 或具体状态；平台级，不限定选店渠道） */
    async adminList(ctx: RequestContext, status?: string, skip?: number, take?: number) {
        const pc = await this.platformCtx();
        const qb = this.connection.getRepository(pc, RiderWithdrawalRequest).createQueryBuilder('w');
        if (status && status !== 'ALL') {
            qb.andWhere('w.status = :s', { s: status });
        }
        const safeSkip = Math.max(0, skip ?? 0);
        const safeTake = Math.min(Math.max(take ?? 20, 1), 200);
        return qb.orderBy('w.createdAt', 'DESC').skip(safeSkip).take(safeTake).getMany();
    }

    /** 管理端：通过打款（金额已在申请时扣减；必须登记打款流水号，凭证可选） */
    async adminApprove(ctx: RequestContext, id: any, remark?: string, payoutRef?: string, payoutProof?: string) {
        const ref = String(payoutRef ?? '').trim();
        if (!ref) throw new UserInputError('请填写打款流水号（用于对账留痕）');
        if (ref.length > 255) throw new UserInputError('打款流水号不能超过 255 个字符');
        const proof = String(payoutProof ?? '').trim();
        if (proof.length > 255) throw new UserInputError('打款凭证链接不能超过 255 个字符');
        const req = await this.getForReview(id);
        const pc = await this.platformCtx();
        const repo = this.connection.getRepository(pc, RiderWithdrawalRequest);
        // 原子认领：UPDATE ... WHERE status='PENDING'（条件必须在 where 里才生效，
        // 仅按 id 更新的 affected 恒为 1，并发「通过 + 驳回」都会成功 → 可能又退款又标记已打款）
        const claim = await repo
            .createQueryBuilder()
            .update(RiderWithdrawalRequest)
            .set({
                status: 'PAID',
                remark: remark?.trim() || req.remark || null,
                reviewedBy: this.reviewer(ctx),
                reviewedAt: new Date(),
                payoutRef: ref,
                payoutProof: proof || null,
            } as any)
            .where('id = :id', { id: req.id })
            .andWhere('status = :s', { s: 'PENDING' })
            .execute();
        if (!(claim?.affected ?? 0)) throw new UserInputError('该申请已处理');
        return repo.findOne({ where: { id: req.id as any } });
    }

    /** 管理端：驳回（退回冻结金额 + 留痕；退回资金固定默认渠道，与申请扣款同渠道） */
    async adminReject(ctx: RequestContext, id: any, remark?: string) {
        const pc = await this.platformCtx();
        const repo = this.connection.getRepository(pc, RiderWithdrawalRequest);
        const req = await repo.findOne({ where: { id } });
        if (!req) throw new UserInputError('提现申请不存在');
        // F3 原子认领：UPDATE ... WHERE status='PENDING'，防并发双审 → 双重退回；
        // 先改状态再退回，退回失败补偿恢复 PENDING 以便重试（避免「已驳回但钱未退」）
        const claim = await repo
            .createQueryBuilder()
            .update(RiderWithdrawalRequest)
            .set({
                status: 'REJECTED',
                remark: remark?.trim() || req.remark || null,
                reviewedBy: this.reviewer(ctx),
                reviewedAt: new Date(),
            } as any)
            .where('id = :id', { id: req.id })
            .andWhere('status = :s', { s: 'PENDING' })
            .execute();
        if (!(claim?.affected ?? 0)) throw new UserInputError('该申请已处理');
        const port = getCouponBalancePort();
        if (port) {
            try {
                await port.addBalance(pc, req.customerId, req.amount);
            } catch (e: any) {
                // 仅当本次认领仍为 REJECTED 时恢复（防已被并发改为 PAID 时回滚错状态）
                await repo
                    .update({ id: req.id, status: 'REJECTED' } as any, { status: 'PENDING' } as any)
                    .catch(() => undefined);
                Logger.error(`驳回退回失败（已恢复 PENDING 可重试）：${e?.message ?? e}`, 'RiderWallet');
                throw new UserInputError('退回失败，请稍后重试');
            }
        } else {
            Logger.warn('余额端口未注册，驳回退回未执行', 'RiderWallet');
        }
        return repo.findOne({ where: { id: req.id as any } });
    }

    private reviewer(ctx: RequestContext): string | null {
        return ctx.activeUserId ? String(ctx.activeUserId) : null;
    }

    /** 审核前置校验（平台级：不限定 channelId） */
    private async getForReview(id: any) {
        const pc = await this.platformCtx();
        const req = await this.connection.getRepository(pc, RiderWithdrawalRequest).findOne({ where: { id } });
        if (!req) throw new UserInputError('提现申请不存在');
        if (req.status !== 'PENDING') throw new UserInputError('该申请已处理');
        return req;
    }

    private async sumPending(ctx: RequestContext, customerId: number) {
        const row = await this.connection
            .getRepository(ctx, RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .select('COALESCE(SUM(w.amount), 0)', 'sum')
            .where('w.customerId = :id', { id: customerId })
            .andWhere('w.status = :s', { s: 'PENDING' })
            .getRawOne();
        return Number(row?.sum) || 0;
    }

    private async sumEarned(ctx: RequestContext, riderCustomerId: number) {
        // 骑手为平台级角色：分成流水写在各店铺渠道，钱包查询固定默认渠道上下文，
        // 按渠道过滤会导致累计收入恒为 0，此处跨渠道汇总。
        // 口径：入账只加 e.amount（小费已包含在分成金额内），故累计收入只 SUM(amount)，
        // 不能再加 e.tip，否则小费被重复计入累计。
        const row = await this.connection
            .getRepository(ctx, RiderEarning)
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.amount), 0)', 'sum')
            .where('e.riderCustomerId = :id', { id: riderCustomerId })
            .getRawOne();
        return Number(row?.sum) || 0;
    }
}
