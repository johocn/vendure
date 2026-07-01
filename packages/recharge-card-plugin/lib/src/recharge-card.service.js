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
    async addBalance(ctx, customerId, amount) {
        const repo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        let record = await repo.findOne({
            where: { customerId: customerId, channelId: ctx.channelId },
        });
        if (!record) {
            record = new customer_balance_entity_1.CustomerBalance({
                customerId: customerId,
                channelId: ctx.channelId,
                balance: 0,
            });
        }
        record.balance += amount;
        await repo.save(record);
        return record.balance;
    }
    async deductBalance(ctx, customerId, amount) {
        var _a;
        const repo = this.connection.getRepository(ctx, customer_balance_entity_1.CustomerBalance);
        const record = await repo.findOne({
            where: { customerId: customerId, channelId: ctx.channelId },
        });
        if (!record || record.balance < amount) {
            return { success: false, balance: (_a = record === null || record === void 0 ? void 0 : record.balance) !== null && _a !== void 0 ? _a : 0 };
        }
        record.balance -= amount;
        await repo.save(record);
        return { success: true, balance: record.balance };
    }
    // ===== Card Operations =====
    async redeemCard(ctx, code, pin) {
        if (!ctx.activeUserId) {
            throw new Error('Must be logged in to redeem a recharge card');
        }
        const repo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        const card = await repo.findOne({ where: { code } });
        if (!card) {
            throw new Error('Invalid recharge card code');
        }
        if (card.state !== 'unused') {
            throw new Error(`Card is already ${card.state}`);
        }
        if (card.expiresAt && new Date() > card.expiresAt) {
            card.state = 'expired';
            await repo.save(card);
            throw new Error('Card has expired');
        }
        if (card.pin && pin !== card.pin) {
            throw new Error('Invalid PIN');
        }
        card.state = 'used';
        card.redeemedByCustomerId = ctx.activeUserId;
        card.redeemedAt = new Date();
        await repo.save(card);
        await this.addBalance(ctx, ctx.activeUserId, card.faceValue);
        core_1.Logger.info(`Card ${code} redeemed by customer ${ctx.activeUserId}, added ${card.faceValue} to balance`, constants_1.loggerCtx);
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
        for (let i = 0; i < input.quantity; i++) {
            const code = `${savedBatch.prefix}${Date.now()}${crypto_1.default.randomBytes(4).toString('hex')}`.toUpperCase();
            const pin = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
            const card = new recharge_card_entity_1.RechargeCard({
                code,
                pin,
                faceValue: input.faceValue,
                state: 'unused',
                batchId: savedBatch.id,
                expiresAt: input.expiresAt || null,
            });
            card.channels = [ctx.channel];
            cards.push(card);
        }
        await cardRepo.save(cards);
        savedBatch.generatedCount = input.quantity;
        await batchRepo.save(savedBatch);
        core_1.Logger.info(`Created batch ${savedBatch.name} with ${input.quantity} cards`, constants_1.loggerCtx);
        return savedBatch;
    }
    async freezeCard(ctx, id) {
        const repo = this.connection.getRepository(ctx, recharge_card_entity_1.RechargeCard);
        const card = await repo.findOne({ where: { id: id } });
        if (!card)
            throw new Error('Card not found');
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
            throw new Error('Card not found');
        if (card.state === 'frozen') {
            card.state = 'unused';
            await repo.save(card);
        }
        return card;
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