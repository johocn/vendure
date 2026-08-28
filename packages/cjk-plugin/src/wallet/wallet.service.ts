import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
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
     */
    async debit(ctx: RequestContext, amount: number): Promise<Wallet> {
        const amt = this.validateAmount(amount);
        await this.connection.startTransaction(ctx);
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
            await this.connection.commitOpenTransaction(ctx);
            return wallet;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    /** 充值 / 入账：原子累加。 */
    async credit(ctx: RequestContext, amount: number): Promise<Wallet> {
        const amt = this.validateAmount(amount);
        await this.connection.startTransaction(ctx);
        try {
            await this.get(ctx);
            const repo = this.connection.getRepository(ctx, Wallet);
            await repo
                .createQueryBuilder()
                .update(Wallet)
                .set({ balance: () => `balance + ${amt}` })
                .execute();
            const wallet = await this.get(ctx);
            await this.connection.commitOpenTransaction(ctx);
            return wallet;
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    private validateAmount(amount: number): number {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt < 0) {
            throw new UserInputError(`Invalid wallet amount: ${amount}`);
        }
        return amt;
    }
}