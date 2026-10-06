import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, RequestContextService, TransactionalConnection, UserInputError } from '@vendure/core';
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
        const port = getCouponBalancePort();
        const available = port ? await port.getBalance(pc, rider.id as number) : 0;
        const frozen = await this.sumPending(pc, rider.id as number);
        const totalEarned = await this.sumEarned(pc, rider.id as number);
        return { available, frozen, totalEarned };
    }

    /** 余额流水（recharge-card BalanceTransaction，默认渠道本人倒序） */
    async riderBalanceHistory(ctx: RequestContext, skip?: number, take?: number) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        return this.connection
            .getRepository(pc, BalanceTransaction)
            .createQueryBuilder('tx')
            .where('tx.customerId = :id', { id: rider.id })
            .andWhere('tx.channelId = :ch', { ch: pc.channelId })
            .orderBy('tx.createdAt', 'DESC')
            .skip(skip ?? 0)
            .take(take ?? 20)
            .getMany();
    }

    /** 本人提现申请记录（平台级，倒序） */
    async riderWithdrawRequests(ctx: RequestContext, skip?: number, take?: number) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const pc = await this.platformCtx();
        return this.connection
            .getRepository(pc, RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .where('w.customerId = :id', { id: rider.id })
            .orderBy('w.createdAt', 'DESC')
            .skip(skip ?? 0)
            .take(take ?? 20)
            .getMany();
    }

    /** 提现申请：校验骑手 + ≥¥10 + ≤可提现 → 扣款冻结 → PENDING 申请 */
    async riderWithdraw(ctx: RequestContext, input: { amount: number; channel: string; account: string }) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const amount = Math.floor(input.amount);
        if (!amount || amount < MIN_WITHDRAW_AMOUNT) throw new UserInputError('最低提现金额为 ¥10');
        if (!input.channel?.trim()) throw new UserInputError('请选择收款渠道');
        if (!input.account?.trim()) throw new UserInputError('请填写收款账号');
        const pc = await this.platformCtx();
        const port = getCouponBalancePort();
        if (!port) throw new UserInputError('余额功能未开通');
        const available = await port.getBalance(pc, rider.id as number);
        if (amount > available) throw new UserInputError('超过可提现余额');
        await port.deductBalance(pc, rider.id as number, amount);
        return this.connection.getRepository(pc, RiderWithdrawalRequest).save({
            customerId: rider.id,
            channelId: pc.channelId,
            amount,
            channel: input.channel.trim(),
            account: input.account.trim(),
            status: 'PENDING',
        } as any);
    }

    /** 管理端：提现申请列表（status=ALL 或具体状态；平台级，不限定选店渠道） */
    async adminList(ctx: RequestContext, status?: string, skip?: number, take?: number) {
        const pc = await this.platformCtx();
        const qb = this.connection.getRepository(pc, RiderWithdrawalRequest).createQueryBuilder('w');
        if (status && status !== 'ALL') {
            qb.andWhere('w.status = :s', { s: status });
        }
        return qb.orderBy('w.createdAt', 'DESC').skip(skip ?? 0).take(take ?? 20).getMany();
    }

    /** 管理端：通过打款（仅留痕，金额已在申请时扣减） */
    async adminApprove(ctx: RequestContext, id: any, remark?: string) {
        const req = await this.getForReview(id);
        const pc = await this.platformCtx();
        const repo = this.connection.getRepository(pc, RiderWithdrawalRequest);
        await repo.update(req.id, {
            status: 'PAID',
            remark: remark?.trim() || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        } as any);
        return repo.findOne({ where: { id: req.id as any } });
    }

    /** 管理端：驳回（退回冻结金额 + 留痕；退回资金固定默认渠道，与申请扣款同渠道） */
    async adminReject(ctx: RequestContext, id: any, remark?: string) {
        const req = await this.getForReview(id);
        const pc = await this.platformCtx();
        const port = getCouponBalancePort();
        if (port) {
            await port.addBalance(pc, req.customerId, req.amount);
        } else {
            Logger.warn('余额端口未注册，驳回退回未执行', 'RiderWallet');
        }
        const repo = this.connection.getRepository(pc, RiderWithdrawalRequest);
        await repo.update(req.id, {
            status: 'REJECTED',
            remark: remark?.trim() || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        } as any);
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
        const row = await this.connection
            .getRepository(ctx, RiderEarning)
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.amount + e.tip), 0)', 'sum')
            .where('e.riderCustomerId = :id', { id: riderCustomerId })
            .andWhere('e.channelId = :ch', { ch: ctx.channelId })
            .getRawOne();
        return Number(row?.sum) || 0;
    }
}
