import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { loggerCtx } from '../constants';
import { perf } from '../order/timing.util';
import { Wallet } from './wallet.entity';

/**
 * 全局共享余额钱包服务
 *
 * 内存行：全局仅维护一行 Wallet（findOne 取第一条），不存在则初始化。
 * 扣款/充值均通过显式事务 + 原子 UPDATE 完成，保证并发下不超扣。
 */
@Injectable()
export class WalletService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * 取全局钱包（不存在则用初始化渠道的币种初始化一行，余额 0）。
     * 该方法不自行开事务（可能在调用方已开启的事务内被复用）。
     */
    async get(ctx: RequestContext): Promise<Wallet> {
        const repo = this.connection.getRepository(ctx, Wallet);
        const existing = await repo.find({ order: { id: 'ASC' }, take: 1 });
        if (existing.length > 0) return existing[0];
        const currencyCode = (ctx.channel as any)?.currencyCode ?? 'CNY';
        const created = await repo.save(new Wallet({ balance: 0, currencyCode }));
        return created;
    }

    /**
     * 原子扣款。余额不足抛错（抛错而非静默）。
     * 事务内：确保钱包行存在 → 原子 `balance = balance - amount` 且 `balance >= amount` 守卫。
     *
     * 【重要 2026-09-04】仅当本方法**自己**开启事务时才负责提交/回滚。
     * 若 ctx 上已存在外层事务（如 checkoutSplitted 的 @Transaction、退款事务），
     * 只把 UPDATE 加入外层事务，绝不 startTransaction/commitOpenTransaction——
     * 否则 commitOpenTransaction 会把外层事务**提前 COMMIT**，导致后续单款/台账写入
     * 退化为自动提交、原子性丧失、且订单状态（ArrangingPayment→PaymentSettled）被时间拉开（约 8s）。
     */
    async debit(ctx: RequestContext, amount: number): Promise<Wallet> {
        const t0 = perf();
        const amt = this.validateAmount(amount);
        const ownsTxn = !this.hasOpenTransaction(ctx);
        if (ownsTxn) await this.connection.startTransaction(ctx);
        try {
            await this.get(ctx);
            const repo = this.connection.getRepository(ctx, Wallet);
            const result = await repo
                .createQueryBuilder()
                .update(Wallet)
                .set({ balance: () => `balance - ${amt}` })
                .where('balance >= :amt', { amt })
                .execute();
            if (result.affected === 0) {
                throw new UserInputError('Insufficient wallet balance');
            }
            const wallet = await this.get(ctx);
            if (ownsTxn) await this.connection.commitOpenTransaction(ctx);
            Logger.info(`[timing] wallet.debit amt=${amt} = ${perf(t0)}ms`, loggerCtx);
            return wallet;
        } catch (e) {
            // 仅回滚自己开启的事务；外层事务交给调用方统一提交/回滚，避免提前提交或提前回滚调用方事务
            if (ownsTxn) {
                try {
                    await this.connection.rollBackTransaction(ctx);
                } catch {
                    /* 忽略回滚自身失败 */
                }
            }
            throw e;
        }
    }

    /** 充值 / 入账：原子累加。事务归属规则同 debit（仅自己开启时才提交/回滚）。 */
    async credit(ctx: RequestContext, amount: number): Promise<Wallet> {
        const amt = this.validateAmount(amount);
        const ownsTxn = !this.hasOpenTransaction(ctx);
        if (ownsTxn) await this.connection.startTransaction(ctx);
        try {
            await this.get(ctx);
            const repo = this.connection.getRepository(ctx, Wallet);
            await repo
                .createQueryBuilder()
                .update(Wallet)
                .set({ balance: () => `balance + ${amt}` })
                .execute();
            const wallet = await this.get(ctx);
            if (ownsTxn) await this.connection.commitOpenTransaction(ctx);
            return wallet;
        } catch (e) {
            if (ownsTxn) {
                try {
                    await this.connection.rollBackTransaction(ctx);
                } catch {
                    /* 忽略回滚自身失败 */
                }
            }
            throw e;
        }
    }

    /** ctx 上是否已存在开启的外层事务（@Transaction / withTransaction 阶段）。
     *  事务中 getRepository(ctx,…) 返回绑定事务 queryRunner 的仓库，其 manager.queryRunner.isTransactionActive 为真；
     *  非事务路径返回裸仓库（dataSource.manager 无 queryRunner）→ 判 false。 */
    private hasOpenTransaction(ctx: RequestContext): boolean {
        const repo = this.connection.getRepository(ctx, Wallet) as any;
        return !!repo?.manager?.queryRunner?.isTransactionActive;
    }

    private validateAmount(amount: number): number {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt < 0) {
            throw new UserInputError(`Invalid wallet amount: ${amount}`);
        }
        return amt;
    }
}