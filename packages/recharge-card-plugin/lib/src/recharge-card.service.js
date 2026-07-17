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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeCardService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("./constants");
const recharge_card_entity_1 = require("./recharge-card.entity");
const recharge_card_batch_entity_1 = require("./recharge-card-batch.entity");
const customer_balance_entity_1 = require("./customer-balance.entity");
const balance_transaction_entity_1 = require("./balance-transaction.entity");
const SCRYPT_KEYLEN = 64;
function scryptDerive(password, salt) {
    return new Promise((resolve, reject) => {
        crypto_1.default.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
            if (err)
                reject(err);
            else
                resolve(derivedKey);
        });
    });
}
async function hashPin(pin) {
    const salt = crypto_1.default.randomBytes(16);
    const hash = await scryptDerive(pin, salt);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
async function verifyPin(pin, stored) {
    if (!stored)
        return true;
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt')
        return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const test = await scryptDerive(pin, salt);
    if (test.length !== expected.length)
        return false;
    return crypto_1.default.timingSafeEqual(test, expected);
}
let RechargeCardService = class RechargeCardService {
    constructor(connection, listQueryBuilder, customerService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
    }
    // ===== Balance Operations =====
    async getBalance(ctx) {
        var _a;
        if (!ctx.activeUserId)
            return 0;
        const repo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        const record = await repo.findOne({
            where: { customerId: ctx.activeUserId, channelId: ctx.channelId },
        });
        return (_a = record === null || record === void 0 ? void 0 : record.balance) !== null && _a !== void 0 ? _a : 0;
    }
    async addBalance(ctx, customerId, amount, orderId, paymentId, type = balance_transaction_entity_1.BalanceTransactionType.REFUND) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new core_1.UserInputError('Invalid amount');
        }
        await this.connection.startTransaction(ctx);
        try {
            const result = await this.applyBalanceChange(ctx, customerId, amt, type, {
                orderId: orderId !== null && orderId !== void 0 ? orderId : null,
                paymentId: paymentId !== null && paymentId !== void 0 ? paymentId : null,
            });
            await this.connection.commitOpenTransaction(ctx);
            return result;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    async deductBalance(ctx, customerId, amount, orderId, paymentId) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new core_1.UserInputError('Invalid amount');
        }
        await this.connection.startTransaction(ctx);
        try {
            const result = await this.applyBalanceChange(ctx, customerId, -amt, balance_transaction_entity_1.BalanceTransactionType.CONSUME, {
                orderId: orderId !== null && orderId !== void 0 ? orderId : null,
                paymentId: paymentId !== null && paymentId !== void 0 ? paymentId : null,
            });
            await this.connection.commitOpenTransaction(ctx);
            return result;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    // ===== Card Operations =====
    async redeemCard(ctx, code, pin) {
        if (!ctx.activeUserId) {
            throw new core_1.UserInputError('Must be logged in to redeem a recharge card');
        }
        const repo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        const card = await repo.findOne({ where: { code } });
        if (!card) {
            throw new core_1.UserInputError('Invalid recharge card code');
        }
        if (card.state !== 'unused') {
            throw new core_1.UserInputError(`Card is already ${card.state}`);
        }
        if (card.expiresAt && new Date() > card.expiresAt) {
            await this.connection.startTransaction(ctx);
            try {
                await repo.createQueryBuilder()
                    .update(recharge_card_entity_1.RechargeCard)
                    .set({ state: 'expired' })
                    .where('id = :id AND state = :state', { id: card.id, state: 'unused' })
                    .execute();
                await this.connection.commitOpenTransaction(ctx);
            }
            catch (e) {
                await this.connection.rollBackTransaction(ctx);
                throw e;
            }
            throw new core_1.UserInputError('Card has expired');
        }
        if (card.pinHash) {
            if (!pin || !(await verifyPin(pin, card.pinHash))) {
                throw new core_1.UserInputError('Invalid code or PIN');
            }
        }
        await this.connection.startTransaction(ctx);
        try {
            // Atomically mark card as used (prevents double-redeem under concurrency)
            const claimResult = await repo.createQueryBuilder()
                .update(recharge_card_entity_1.RechargeCard)
                .set({
                state: 'used',
                redeemedByCustomerId: ctx.activeUserId,
                redeemedAt: new Date(),
            })
                .where('id = :id AND state = :state', { id: card.id, state: 'unused' })
                .execute();
            if (claimResult.affected === 0) {
                throw new core_1.UserInputError(`Card is already ${card.state}`);
            }
            // Credit balance + record transaction within the same transaction
            await this.applyBalanceChange(ctx, ctx.activeUserId, card.faceValue, balance_transaction_entity_1.BalanceTransactionType.RECHARGE, {
                rechargeCardId: card.id,
            });
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        core_1.Logger.info(`Card ${code} redeemed by customer ${ctx.activeUserId}, added ${card.faceValue} to balance`, constants_1.loggerCtx);
        card.state = 'used';
        return card;
    }
    async findMyCards(ctx) {
        if (!ctx.activeUserId)
            return [];
        const repo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        return repo.find({
            where: { redeemedByCustomerId: ctx.activeUserId },
            order: { createdAt: 'DESC' },
        });
    }
    // ===== Admin Operations =====
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(recharge_card_entity_1.RechargeCard, options, { ctx, relations: ['channels'], channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findAllBatches(ctx, options) {
        return this.listQueryBuilder
            .build(recharge_card_batch_entity_1.RechargeCardBatch, options, { ctx, relations: ['channels'], channelId: ctx.channelId })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async createBatch(ctx, input) {
        const batchRepo = this.connection.getRepository(ctx, recharge_card_batch_entity_1.RechargeCardBatch);
        const cardRepo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        const batch = new recharge_card_batch_entity_1.RechargeCardBatch({
            name: input.name,
            prefix: input.prefix || 'RC',
            faceValue: input.faceValue,
            quantity: input.quantity,
            expiresAt: input.expiresAt || null,
        });
        batch.channels = [ctx.channel];
        const savedBatch = await batchRepo.save(batch);
        const cards = [];
        const plaintextPins = [];
        for (let i = 0; i < input.quantity; i++) {
            const code = `${savedBatch.prefix}${Date.now()}${crypto_1.default.randomBytes(4).toString('hex')}`.toUpperCase();
            // 12-char hex PIN = 48 bit entropy (up from 24 bit)
            const pin = crypto_1.default.randomBytes(6).toString('hex').toUpperCase();
            const pinHash = await hashPin(pin);
            const card = new recharge_card_entity_1.RechargeCard({
                code,
                pinHash,
                faceValue: input.faceValue,
                state: 'unused',
                batchId: savedBatch.id,
                expiresAt: input.expiresAt || null,
            });
            card.channels = [ctx.channel];
            cards.push(card);
            plaintextPins.push({ code, pin });
        }
        await cardRepo.save(cards);
        savedBatch.generatedCount = input.quantity;
        savedBatch.plaintextPins = plaintextPins;
        await batchRepo.save(savedBatch);
        core_1.Logger.info(`Created batch ${savedBatch.name} with ${input.quantity} cards`, constants_1.loggerCtx);
        return savedBatch;
    }
    async freezeCard(ctx, id) {
        const repo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        const card = await repo.findOne({ where: { id: id } });
        if (!card)
            throw new core_1.UserInputError('Card not found');
        if (card.state === 'unused') {
            card.state = 'frozen';
            await repo.save(card);
        }
        return card;
    }
    async unfreezeCard(ctx, id) {
        const repo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        const card = await repo.findOne({ where: { id: id } });
        if (!card)
            throw new core_1.UserInputError('Card not found');
        if (card.state === 'frozen') {
            card.state = 'unused';
            await repo.save(card);
        }
        return card;
    }
    // ===== Internal helpers =====
    /**
     * Applies an atomic balance change and records a BalanceTransaction.
     * Must be called within an already-started transaction.
     * `delta` > 0 adds balance, `delta` < 0 deducts (with sufficiency check).
     * Returns the balance after the change.
     */
    async applyBalanceChange(ctx, customerId, delta, type, meta) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        const absAmt = Math.abs(delta);
        const cid = customerId;
        const chid = ctx.channelId;
        if (delta < 0) {
            const result = await repo.createQueryBuilder()
                .update(customer_balance_entity_1.CustomerBalance)
                .set({ balance: () => `balance - ${absAmt}` })
                .where('customerId = :cid AND channelId = :chid AND balance >= :amt', {
                cid, chid, amt: absAmt,
            })
                .execute();
            if (result.affected === 0) {
                throw new core_1.UserInputError('Insufficient balance');
            }
        }
        else {
            const result = await repo.createQueryBuilder()
                .update(customer_balance_entity_1.CustomerBalance)
                .set({ balance: () => `balance + ${absAmt}` })
                .where('customerId = :cid AND channelId = :chid', { cid, chid })
                .execute();
            if (result.affected === 0) {
                // Balance row does not exist yet; create it. A concurrent insert
                // would fail on the (customer, channel) unique constraint, in which
                // case we fall back to a second atomic update.
                try {
                    await repo.save(new customer_balance_entity_1.CustomerBalance({
                        customerId: cid,
                        channelId: chid,
                        balance: absAmt,
                    }));
                }
                catch (e) {
                    await repo.createQueryBuilder()
                        .update(customer_balance_entity_1.CustomerBalance)
                        .set({ balance: () => `balance + ${absAmt}` })
                        .where('customerId = :cid AND channelId = :chid', { cid, chid })
                        .execute();
                }
            }
        }
        const record = await repo.findOne({ where: { customerId: cid, channelId: chid } });
        const balanceAfter = (_a = record === null || record === void 0 ? void 0 : record.balance) !== null && _a !== void 0 ? _a : 0;
        const balanceBefore = balanceAfter - delta;
        await this.connection.getRepository(ctx, balance_transaction_entity_1.BalanceTransaction).save(new balance_transaction_entity_1.BalanceTransaction({
            customerId: cid,
            type,
            amount: delta,
            balanceBefore,
            balanceAfter,
            orderId: meta.orderId,
            paymentId: meta.paymentId,
            rechargeCardId: meta.rechargeCardId,
            remark: (_b = meta.remark) !== null && _b !== void 0 ? _b : null,
        }));
        return balanceAfter;
    }
};
exports.RechargeCardService = RechargeCardService;
exports.RechargeCardService = RechargeCardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService])
], RechargeCardService);
//# sourceMappingURL=recharge-card.service.js.map