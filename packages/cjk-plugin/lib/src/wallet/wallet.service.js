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
     */
    async debit(ctx, amount) {
        const amt = this.validateAmount(amount);
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
            await this.connection.commitOpenTransaction(ctx);
            return wallet;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    /** 充值 / 入账：原子累加。 */
    async credit(ctx, amount) {
        const amt = this.validateAmount(amount);
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
            await this.connection.commitOpenTransaction(ctx);
            return wallet;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
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