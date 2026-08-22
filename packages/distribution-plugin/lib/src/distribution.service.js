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
const commission_record_entity_1 = require("./commission-record.entity");
const constants_1 = require("./constants");
let DistributionService = class DistributionService {
    constructor(connection, listQueryBuilder, customerService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
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
                if (level > 3) {
                    throw new core_1.UserInputError('Maximum 3 levels of distribution relationship allowed');
                }
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
        const saved = await this.connection.getRepository(ctx, distributor_entity_1.Distributor).save(distributor);
        // 回写 customer.customFields.referralCode（自己的码）与 referredBy（推荐人的码）
        try {
            const customer = await this.customerService.findOne(ctx, customerId);
            if (customer) {
                await this.customerService.update(ctx, {
                    id: customer.id,
                    customFields: Object.assign({ referralCode: saved.referralCode }, (referredByCode ? { referredBy: referredByCode } : {})),
                });
            }
        }
        catch (e) {
            // 回写失败不影响分销商创建
            core_1.Logger.warn(`Failed to write back referralCode to customer ${customerId}: ${e.message}`, constants_1.loggerCtx);
        }
        return saved;
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
    async getTeamSummary(ctx, distributorId) {
        var _a, _b, _c;
        const repo = this.connection.getRepository(ctx, distributor_entity_1.Distributor);
        const channelId = ctx.channelId;
        // 直推下级：parentId = 当前分销员（限当前 channel）
        const directChildren = await repo
            .createQueryBuilder('d')
            .innerJoin('d.channels', 'channel')
            .where('d.parentId = :pid', { pid: String(distributorId) })
            .andWhere('channel.id = :channelId', { channelId })
            .getMany();
        const directIds = directChildren.map(c => c.id);
        const directTeamSize = directChildren.length;
        // 间推下级：parentId ∈ 直推 ids（限当前 channel）
        let indirectTeamSize = 0;
        if (directIds.length) {
            indirectTeamSize = await repo
                .createQueryBuilder('d')
                .innerJoin('d.channels', 'channel')
                .where('d.parentId IN (:...ids)', { ids: directIds.map(String) })
                .andWhere('channel.id = :channelId', { channelId })
                .getCount();
        }
        // 当前分销员带来的订单与收益（仅 confirmed/paid，避免 pending 未结算虚高）
        const crRepo = this.connection.getRepository(ctx, commission_record_entity_1.CommissionRecord);
        const rows = await crRepo
            .createQueryBuilder('cr')
            .select('COUNT(DISTINCT cr.orderId)', 'orderCount')
            .addSelect('COALESCE(SUM(cr.orderAmount),0)', 'orderAmount')
            .addSelect('COALESCE(SUM(cr.commissionAmount),0)', 'commission')
            .where('cr.distributorId = :did', { did: String(distributorId) })
            .andWhere('cr.status IN (:...s)', { s: ['confirmed', 'paid'] })
            .getRawOne();
        return {
            directTeamSize,
            indirectTeamSize,
            totalTeamSize: directTeamSize + indirectTeamSize,
            orderCount: Number((_a = rows === null || rows === void 0 ? void 0 : rows.orderCount) !== null && _a !== void 0 ? _a : 0),
            orderAmount: Number((_b = rows === null || rows === void 0 ? void 0 : rows.orderAmount) !== null && _b !== void 0 ? _b : 0),
            teamCommission: Number((_c = rows === null || rows === void 0 ? void 0 : rows.commission) !== null && _c !== void 0 ? _c : 0),
        };
    }
};
exports.DistributionService = DistributionService;
exports.DistributionService = DistributionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService])
], DistributionService);
//# sourceMappingURL=distribution.service.js.map