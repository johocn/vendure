"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const timing_util_1 = require("../order/timing.util");
const wallet_entity_1 = require("./wallet.entity");
/**
 * 全局共享余额钱包服务
 *
 * 内存行：全局仅维护一行 Wallet（findOne 取第一条），不存在则初始化。
 * 扣款/充值均通过显式事务 + 原子 UPDATE 完成，保证并发下不超扣。
 */
let WalletService = class WalletService {
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * 取全局钱包（不存在则用初始化渠道的币种初始化一行，余额 0）。
     * 该方法不自行开事务（可能在调用方已开启的事务内被复用）。
     */
    async get(ctx) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, wallet_entity_1.Wallet);
        const existing = await repo.find({ order: { id: 'ASC' }, take: 1 });
        if (existing.length > 0)
            return existing[0];
        const currencyCode = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.currencyCode) !== null && _b !== void 0 ? _b : 'CNY';
        const created = await repo.save(new wallet_entity_1.Wallet({ balance: 0, currencyCode }));
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
    async debit(ctx, amount) {
        const t0 = (0, timing_util_1.perf)();
        const amt = this.validateAmount(amount);
        const ownsTxn = !this.hasOpenTransaction(ctx);
        if (ownsTxn)
            await this.connection.startTransaction(ctx);
        try {
            await this.get(ctx);
            const repo = this.connection.getRepository(ctx, wallet_entity_1.Wallet);
            const result = await repo
                .createQueryBuilder()
                .update(wallet_entity_1.Wallet)
                .set({ balance: () => `balance - ${amt}` })
                .where('balance >= :amt', { amt })
                .execute();
            if (result.affected === 0) {
                throw new core_1.UserInputError('Insufficient wallet balance');
            }
            const wallet = await this.get(ctx);
            if (ownsTxn)
                await this.connection.commitOpenTransaction(ctx);
            core_1.Logger.info(`[timing] wallet.debit amt=${amt} = ${(0, timing_util_1.perf)(t0)}ms`, constants_1.loggerCtx);
            return wallet;
        }
        catch (e) {
            // 仅回滚自己开启的事务；外层事务交给调用方统一提交/回滚，避免提前提交或提前回滚调用方事务
            if (ownsTxn) {
                try {
                    await this.connection.rollBackTransaction(ctx);
                }
                catch (_a) {
                    /* 忽略回滚自身失败 */
                }
            }
            throw e;
        }
    }
    /** 充值 / 入账：原子累加。事务归属规则同 debit（仅自己开启时才提交/回滚）。 */
    async credit(ctx, amount) {
        const amt = this.validateAmount(amount);
        const ownsTxn = !this.hasOpenTransaction(ctx);
        if (ownsTxn)
            await this.connection.startTransaction(ctx);
        try {
            await this.get(ctx);
            const repo = this.connection.getRepository(ctx, wallet_entity_1.Wallet);
            await repo
                .createQueryBuilder()
                .update(wallet_entity_1.Wallet)
                .set({ balance: () => `balance + ${amt}` })
                .execute();
            const wallet = await this.get(ctx);
            if (ownsTxn)
                await this.connection.commitOpenTransaction(ctx);
            return wallet;
        }
        catch (e) {
            if (ownsTxn) {
                try {
                    await this.connection.rollBackTransaction(ctx);
                }
                catch (_a) {
                    /* 忽略回滚自身失败 */
                }
            }
            throw e;
        }
    }
    /** ctx 上是否已存在开启的外层事务（@Transaction / withTransaction 阶段）。
     *  事务中 getRepository(ctx,…) 返回绑定事务 queryRunner 的仓库，其 manager.queryRunner.isTransactionActive 为真；
     *  非事务路径返回裸仓库（dataSource.manager 无 queryRunner）→ 判 false。 */
    hasOpenTransaction(ctx) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, wallet_entity_1.Wallet);
        return !!((_b = (_a = repo === null || repo === void 0 ? void 0 : repo.manager) === null || _a === void 0 ? void 0 : _a.queryRunner) === null || _b === void 0 ? void 0 : _b.isTransactionActive);
    }
    validateAmount(amount) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt < 0) {
            throw new core_1.UserInputError(`Invalid wallet amount: ${amount}`);
        }
        return amt;
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], WalletService);
//# sourceMappingURL=wallet.service.js.map