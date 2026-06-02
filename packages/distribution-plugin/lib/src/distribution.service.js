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
exports.DistributionService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const distributor_entity_1 = require("./distributor.entity");
let DistributionService = class DistributionService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
    }
    findAll(ctx, options) {
        return this.listQueryBuilder
            .build(distributor_entity_1.Distributor, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    findOne(ctx, id) {
        return this.connection
            .findOneInChannel(ctx, distributor_entity_1.Distributor, id, ctx.channelId, { relations: ['channels'] })
            .then(result => result !== null && result !== void 0 ? result : undefined);
    }
    async findByReferralCode(ctx, referralCode) {
        const repo = this.connection.getRepository(ctx, distributor_entity_1.Distributor);
        const result = await repo
            .createQueryBuilder('distributor')
            .leftJoinAndSelect('distributor.channels', 'channel')
            .where('distributor.referralCode = :referralCode', { referralCode })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        return result !== null && result !== void 0 ? result : undefined;
    }
    async findByCustomerId(ctx, customerId) {
        const repo = this.connection.getRepository(ctx, distributor_entity_1.Distributor);
        const result = await repo
            .createQueryBuilder('distributor')
            .leftJoinAndSelect('distributor.channels', 'channel')
            .where('distributor.customerId = :customerId', { customerId })
            .andWhere('channel.id = :channelId', { channelId: ctx.channelId })
            .getOne();
        return result !== null && result !== void 0 ? result : undefined;
    }
    async apply(ctx, customerId, referredByCode) {
        const existing = await this.findByCustomerId(ctx, customerId);
        if (existing) {
            return existing;
        }
        const referralCode = this.generateReferralCode();
        let parentId;
        let level = 1;
        if (referredByCode) {
            const parent = await this.findByReferralCode(ctx, referredByCode);
            if (parent && parent.status === 'active') {
                parentId = parent.id;
                level = parent.level + 1;
            }
        }
        const distributor = new distributor_entity_1.Distributor({
            customerId: String(customerId),
            parentId: parentId != null ? String(parentId) : null,
            level,
            status: 'pending',
            totalEarnings: 0,
            availableBalance: 0,
            frozenBalance: 0,
            referralCode,
        });
        const channel = await this.connection.getEntityOrThrow(ctx, core_1.Channel, ctx.channelId);
        distributor.channels = [channel];
        return this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
    }
    async approve(ctx, id) {
        const distributor = await this.findOne(ctx, id);
        if (!distributor) {
            throw new Error(`Distributor ${id} not found`);
        }
        distributor.status = 'active';
        return this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
    }
    async freeze(ctx, id) {
        const distributor = await this.findOne(ctx, id);
        if (!distributor) {
            throw new Error(`Distributor ${id} not found`);
        }
        distributor.status = 'frozen';
        return this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
    }
    generateReferralCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
};
exports.DistributionService = DistributionService;
exports.DistributionService = DistributionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], DistributionService);
//# sourceMappingURL=distribution.service.js.map