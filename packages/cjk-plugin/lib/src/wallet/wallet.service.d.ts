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
     *
     * 【重要 2026-09-04】仅当本方法**自己**开启事务时才负责提交/回滚。
     * 若 ctx 上已存在外层事务（如 checkoutSplitted 的 @Transaction、退款事务），
     * 只把 UPDATE 加入外层事务，绝不 startTransaction/commitOpenTransaction——
     * 否则 commitOpenTransaction 会把外层事务**提前 COMMIT**，导致后续单款/台账写入
     * 退化为自动提交、原子性丧失、且订单状态（ArrangingPayment→PaymentSettled）被时间拉开（约 8s）。
     */
    debit(ctx: RequestContext, amount: number): Promise<Wallet>;
    /** 充值 / 入账：原子累加。事务归属规则同 debit（仅自己开启时才提交/回滚）。 */
    credit(ctx: RequestContext, amount: number): Promise<Wallet>;
    /** ctx 上是否已存在开启的外层事务（@Transaction / withTransaction 阶段）。
     *  事务中 getRepository(ctx,…) 返回绑定事务 queryRunner 的仓库，其 manager.queryRunner.isTransactionActive 为真；
     *  非事务路径返回裸仓库（dataSource.manager 无 queryRunner）→ 判 false。 */
    private hasOpenTransaction;
    private validateAmount;
}
