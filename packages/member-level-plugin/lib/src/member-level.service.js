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
exports.MemberLevelService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const member_points_history_entity_1 = require("./member-points-history.entity");
const DEFAULT_THRESHOLDS = [0, 1000, 5000, 20000, 100000];
const DEFAULT_NAMES = ['普通会员', '银卡会员', '金卡会员', '白金会员', '钻石会员'];
let MemberLevelService = class MemberLevelService {
    constructor(connection, listQueryBuilder, customerService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
    }
    // ===== Public API =====
    async getMemberInfo(ctx, customerId) {
        const customer = await this.customerService.findOne(ctx, customerId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', customerId);
        }
        return this.buildMemberInfo(ctx, customer);
    }
    async getMyMemberInfo(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.buildMemberInfo(ctx, customer);
    }
    async addGrowthValue(ctx, customerId, amount, source) {
        var _a, _b;
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new core_1.UserInputError('amount must be a non-zero integer');
        }
        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, core_1.Customer);
            const customer = await repo
                .createQueryBuilder('customer')
                .setLock('pessimistic_write')
                .where('customer.id = :id', { id: customerId })
                .getOne();
            if (!customer) {
                throw new core_1.EntityNotFoundError('Customer', customerId);
            }
            const cf = (_a = customer.customFields) !== null && _a !== void 0 ? _a : {};
            const currentGrowth = (_b = cf.growthValue) !== null && _b !== void 0 ? _b : 0;
            const newGrowth = Math.max(0, currentGrowth + amt);
            cf.growthValue = newGrowth;
            const newLevel = this.calculateLevel(ctx, newGrowth);
            cf.memberLevel = newLevel;
            await repo.save(customer);
            await this.connection.commitOpenTransaction(ctx);
            core_1.Logger.info(`Customer ${customerId} growthValue ${currentGrowth} -> ${newGrowth} (${source !== null && source !== void 0 ? source : ''})`, constants_1.loggerCtx);
            return newGrowth;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    async addPoints(ctx, customerId, amount, orderId, remark) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new core_1.UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(ctx, customerId, amt, member_points_history_entity_1.PointsHistoryType.EARN, orderId, remark);
    }
    async spendPoints(ctx, customerId, amount, orderId, remark) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new core_1.UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(ctx, customerId, -amt, member_points_history_entity_1.PointsHistoryType.SPEND, orderId, remark);
    }
    async adjustPoints(ctx, customerId, amount, remark) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new core_1.UserInputError('amount must be a non-zero integer');
        }
        return this.applyPointsChange(ctx, customerId, amt, member_points_history_entity_1.PointsHistoryType.ADJUST, undefined, remark);
    }
    calculateLevel(ctx, growthValue) {
        const { thresholds } = this.getLevelConfig(ctx);
        let level = 1;
        for (let i = 0; i < thresholds.length; i++) {
            if (growthValue >= thresholds[i]) {
                level = i + 1;
            }
        }
        return level;
    }
    async getMyPointsHistory(ctx, options) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return this.getPointsHistory(ctx, customer.id, options);
    }
    async getPointsHistory(ctx, customerId, options) {
        return this.listQueryBuilder
            .build(member_points_history_entity_1.MemberPointsHistory, options, {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
            where: { customerId: customerId },
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async hasPointsRecord(ctx, customerId, orderId, type) {
        const repo = this.connection.getRepository(ctx, member_points_history_entity_1.MemberPointsHistory);
        const count = await repo.count({
            where: { customerId: customerId, orderId: Number(orderId), type },
        });
        return count > 0;
    }
    // ===== Internal helpers =====
    async applyPointsChange(ctx, customerId, delta, type, orderId, remark) {
        var _a, _b;
        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, core_1.Customer);
            const customer = await repo
                .createQueryBuilder('customer')
                .setLock('pessimistic_write')
                .where('customer.id = :id', { id: customerId })
                .getOne();
            if (!customer) {
                throw new core_1.EntityNotFoundError('Customer', customerId);
            }
            const cf = (_a = customer.customFields) !== null && _a !== void 0 ? _a : {};
            const balanceBefore = (_b = cf.points) !== null && _b !== void 0 ? _b : 0;
            const balanceAfter = balanceBefore + delta;
            if (balanceAfter < 0) {
                throw new core_1.UserInputError('Insufficient points');
            }
            cf.points = balanceAfter;
            await repo.save(customer);
            const history = new member_points_history_entity_1.MemberPointsHistory({
                customerId: customerId,
                type,
                amount: delta,
                balanceBefore,
                balanceAfter,
                orderId: orderId != null ? Number(orderId) : null,
                remark: remark !== null && remark !== void 0 ? remark : null,
            });
            history.channels = [ctx.channel];
            await this.connection.getRepository(ctx, member_points_history_entity_1.MemberPointsHistory).save(history);
            await this.connection.commitOpenTransaction(ctx);
            return balanceAfter;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    async buildMemberInfo(ctx, customer) {
        var _a, _b, _c, _d;
        const cf = (_a = customer.customFields) !== null && _a !== void 0 ? _a : {};
        const growthValue = (_b = cf.growthValue) !== null && _b !== void 0 ? _b : 0;
        const points = (_c = cf.points) !== null && _c !== void 0 ? _c : 0;
        const level = (_d = cf.memberLevel) !== null && _d !== void 0 ? _d : this.calculateLevel(ctx, growthValue);
        const levelName = this.getLevelName(ctx, level);
        const next = this.getNextLevel(ctx, level);
        return {
            customerId: customer.id,
            level,
            levelName,
            growthValue,
            points,
            nextLevelThreshold: next.threshold,
            nextLevelName: next.name,
        };
    }
    getLevelConfig(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const cf = (_a = ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
        return {
            thresholds: [
                (_b = cf.level1Threshold) !== null && _b !== void 0 ? _b : DEFAULT_THRESHOLDS[0],
                (_c = cf.level2Threshold) !== null && _c !== void 0 ? _c : DEFAULT_THRESHOLDS[1],
                (_d = cf.level3Threshold) !== null && _d !== void 0 ? _d : DEFAULT_THRESHOLDS[2],
                (_e = cf.level4Threshold) !== null && _e !== void 0 ? _e : DEFAULT_THRESHOLDS[3],
                (_f = cf.level5Threshold) !== null && _f !== void 0 ? _f : DEFAULT_THRESHOLDS[4],
            ],
            names: [
                (_g = cf.level1Name) !== null && _g !== void 0 ? _g : DEFAULT_NAMES[0],
                (_h = cf.level2Name) !== null && _h !== void 0 ? _h : DEFAULT_NAMES[1],
                (_j = cf.level3Name) !== null && _j !== void 0 ? _j : DEFAULT_NAMES[2],
                (_k = cf.level4Name) !== null && _k !== void 0 ? _k : DEFAULT_NAMES[3],
                (_l = cf.level5Name) !== null && _l !== void 0 ? _l : DEFAULT_NAMES[4],
            ],
        };
    }
    getLevelName(ctx, level) {
        const { names } = this.getLevelConfig(ctx);
        return names[Math.min(Math.max(level, 1), 5) - 1];
    }
    getNextLevel(ctx, level) {
        if (level >= 5) {
            return { threshold: null, name: null };
        }
        const { thresholds, names } = this.getLevelConfig(ctx);
        return { threshold: thresholds[level], name: names[level] };
    }
};
exports.MemberLevelService = MemberLevelService;
exports.MemberLevelService = MemberLevelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService])
], MemberLevelService);
//# sourceMappingURL=member-level.service.js.map