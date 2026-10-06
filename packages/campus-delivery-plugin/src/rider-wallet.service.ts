import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { getCouponBalancePort } from '@vendure/coupon-plugin';
import { BalanceTransaction } from '@vendure/recharge-card-plugin';
import { RiderEarning } from './rider-earning.entity';
import { RiderService } from './rider.service';
import { RiderWithdrawalRequest } from './rider-withdrawal.entity';

const MIN_WITHDRAW_AMOUNT = 1000; // 最低提现 ¥10（分）

/** 骑手钱包：余额底座复用 coupon-balance-port（recharge-card CustomerBalance）。
 * 提现即扣减余额（冻结语义：frozen = PENDING 申请合计），驳回退回、打款仅留痕。 */
@Injectable()
export class RiderWalletService {
    constructor(private connection: TransactionalConnection, private riderService: RiderService) {}

    async myRiderWallet(ctx: RequestContext) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const port = getCouponBalancePort();
        const available = port ? await port.getBalance(ctx, rider.id as number) : 0;
        const frozen = await this.sumPending(ctx, rider.id as number);
        const totalEarned = await this.sumEarned(ctx, rider.id as number);
        return { available, frozen, totalEarned };
    }

    /** 余额流水（recharge-card BalanceTransaction，本渠道本人倒序） */
    async riderBalanceHistory(ctx: RequestContext, skip?: number, take?: number) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection
            .getRepository(ctx, BalanceTransaction)
            .createQueryBuilder('tx')
            .where('tx.customerId = :id', { id: rider.id })
            .andWhere('tx.channelId = :ch', { ch: ctx.channelId })
            .orderBy('tx.createdAt', 'DESC')
            .skip(skip ?? 0)
            .take(take ?? 20)
            .getMany();
    }

    /** 本人提现申请记录（倒序） */
    async riderWithdrawRequests(ctx: RequestContext, skip?: number, take?: number) {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection
            .getRepository(ctx, RiderWithdrawalRequest)
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
        const port = getCouponBalancePort();
        if (!port) throw new UserInputError('余额功能未开通');
        const available = await port.getBalance(ctx, rider.id as number);
        if (amount > available) throw new UserInputError('超过可提现余额');
        await port.deductBalance(ctx, rider.id as number, amount);
        return this.connection.getRepository(ctx, RiderWithdrawalRequest).save({
            customerId: rider.id,
            channelId: ctx.channelId,
            amount,
            channel: input.channel.trim(),
            account: input.account.trim(),
            status: 'PENDING',
        } as any);
    }

    /** 管理端：提现申请列表（status=ALL 或具体状态，渠道隔离） */
    async adminList(ctx: RequestContext, status?: string, skip?: number, take?: number) {
        const qb = this.connection
            .getRepository(ctx, RiderWithdrawalRequest)
            .createQueryBuilder('w')
            .where('w.channelId = :ch', { ch: ctx.channelId as any });
        if (status && status !== 'ALL') {
            qb.andWhere('w.status = :s', { s: status });
        }
        return qb.orderBy('w.createdAt', 'DESC').skip(skip ?? 0).take(take ?? 20).getMany();
    }

    /** 管理端：通过打款（仅留痕，金额已在申请时扣减） */
    async adminApprove(ctx: RequestContext, id: any, remark?: string) {
        const req = await this.getForReview(ctx, id);
        const repo = this.connection.getRepository(ctx, RiderWithdrawalRequest);
        await repo.update(req.id, {
            status: 'PAID',
            remark: remark?.trim() || req.remark || null,
            reviewedBy: this.reviewer(ctx),
            reviewedAt: new Date(),
        } as any);
        return repo.findOne({ where: { id: req.id as any } });
    }

    /** 管理端：驳回（退回冻结金额 + 留痕） */
    async adminReject(ctx: RequestContext, id: any, remark?: string) {
        const req = await this.getForReview(ctx, id);
        const port = getCouponBalancePort();
        if (port) {
            await port.addBalance(ctx, req.customerId, req.amount);
        } else {
            Logger.warn('余额端口未注册，驳回退回未执行', 'RiderWallet');
        }
        const repo = this.connection.getRepository(ctx, RiderWithdrawalRequest);
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

    private async getForReview(ctx: RequestContext, id: any) {
        const req = await this.connection
            .getRepository(ctx, RiderWithdrawalRequest)
            .findOne({ where: { id, channelId: ctx.channelId as any } });
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
