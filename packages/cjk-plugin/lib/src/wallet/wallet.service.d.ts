import { RequestContext, TransactionalConnection } from '@vendure/core';
import { Wallet } from './wallet.entity';
/**
 * 全局共享余额钱包服务
 *
 * 内存行：全局仅维护一行 Wallet（findOne 取第一条），不存在则初始化。
 * 扣款/充值均通过显式事务 + 原子 UPDATE 完成，保证并发下不超扣。
 */
export declare class WalletService {
    private connection;
    constructor(connection: TransactionalConnection);
    /**
     * 取全局钱包（不存在则用初始化渠道的币种初始化一行，余额 0）。
     * 该方法不自行开事务（可能在调用方已开启的事务内被复用）。
     */
    get(ctx: RequestContext): Promise<Wallet>;
    /**
     * 原子扣款。余额不足抛错（抛错而非静默）。
     * 事务内：确保钱包行存在 → 原子 `balance = balance - amount` 且 `balance >= amount` 守卫。
     */
    debit(ctx: RequestContext, amount: number): Promise<Wallet>;
    /** 充值 / 入账：原子累加。 */
    credit(ctx: RequestContext, amount: number): Promise<Wallet>;
    private validateAmount;
}
