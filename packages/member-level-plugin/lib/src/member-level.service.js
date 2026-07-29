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
    constructor(connection, listQueryBuilder, customerService, channelService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
        this.channelService = channelService;
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
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt === 0) {
            throw new core_1.UserInputError('amount must be a non-zero integer');
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a, _b;
            const repo = this.connection.getRepository(txCtx, core_1.Customer);
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
            const newLevel = this.calculateLevel(txCtx, newGrowth);
            cf.memberLevel = newLevel;
            await repo.save(customer);
            core_1.Logger.info(`Customer ${customerId} growthValue ${currentGrowth} -> ${newGrowth} (${source !== null && source !== void 0 ? source : ''})`, constants_1.loggerCtx);
            return newGrowth;
        });
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
        const { thresholds } = this.getLevelThresholds(ctx);
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
    async findAllMembers(ctx, options) {
        const listOptions = {};
        if (options) {
            if (options.skip != null)
                listOptions.skip = options.skip;
            if (options.take != null)
                listOptions.take = options.take;
            if (options.filter) {
                const filter = {};
                if (options.filter.emailAddress) {
                    filter.emailAddress = { contains: options.filter.emailAddress };
                }
                if (options.filter.level != null) {
                    filter.customFields = { memberLevel: { eq: options.filter.level } };
                }
                if (Object.keys(filter).length > 0) {
                    listOptions.filter = filter;
                }
            }
        }
        const [customers, totalItems] = await this.listQueryBuilder
            .build(core_1.Customer, listOptions, {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
        })
            .getManyAndCount();
        const items = customers.map((c) => {
            var _a, _b, _c, _d;
            const cf = (_a = c.customFields) !== null && _a !== void 0 ? _a : {};
            const level = (_b = cf.memberLevel) !== null && _b !== void 0 ? _b : 1;
            return {
                customerId: c.id,
                emailAddress: c.emailAddress,
                firstName: c.firstName,
                lastName: c.lastName,
                level,
                levelName: this.getLevelName(ctx, level),
                growthValue: (_c = cf.growthValue) !== null && _c !== void 0 ? _c : 0,
                points: (_d = cf.points) !== null && _d !== void 0 ? _d : 0,
                createdAt: c.createdAt,
            };
        });
        return { items, totalItems };
    }
    getLevelConfig(ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const cf = (_a = ctx.channel.customFields) !== null && _a !== void 0 ? _a : {};
        return {
            level1Threshold: (_b = cf.level1Threshold) !== null && _b !== void 0 ? _b : DEFAULT_THRESHOLDS[0],
            level1Name: (_c = cf.level1Name) !== null && _c !== void 0 ? _c : DEFAULT_NAMES[0],
            level2Threshold: (_d = cf.level2Threshold) !== null && _d !== void 0 ? _d : DEFAULT_THRESHOLDS[1],
            level2Name: (_e = cf.level2Name) !== null && _e !== void 0 ? _e : DEFAULT_NAMES[1],
            level3Threshold: (_f = cf.level3Threshold) !== null && _f !== void 0 ? _f : DEFAULT_THRESHOLDS[2],
            level3Name: (_g = cf.level3Name) !== null && _g !== void 0 ? _g : DEFAULT_NAMES[2],
            level4Threshold: (_h = cf.level4Threshold) !== null && _h !== void 0 ? _h : DEFAULT_THRESHOLDS[3],
            level4Name: (_j = cf.level4Name) !== null && _j !== void 0 ? _j : DEFAULT_NAMES[3],
            level5Threshold: (_k = cf.level5Threshold) !== null && _k !== void 0 ? _k : DEFAULT_THRESHOLDS[4],
            level5Name: (_l = cf.level5Name) !== null && _l !== void 0 ? _l : DEFAULT_NAMES[4],
            pointsEarnRatio: (_m = cf.pointsEarnRatio) !== null && _m !== void 0 ? _m : 1,
            pointsEarnOnShipping: (_o = cf.pointsEarnOnShipping) !== null && _o !== void 0 ? _o : false,
        };
    }
    async updateLevelConfig(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        await this.channelService.update(ctx, {
            id: ctx.channelId,
            customFields: {
                level1Threshold: input.level1Threshold,
                level1Name: input.level1Name,
                level2Threshold: input.level2Threshold,
                level2Name: input.level2Name,
                level3Threshold: input.level3Threshold,
                level3Name: input.level3Name,
                level4Threshold: input.level4Threshold,
                level4Name: input.level4Name,
                level5Threshold: input.level5Threshold,
                level5Name: input.level5Name,
                pointsEarnRatio: input.pointsEarnRatio,
                pointsEarnOnShipping: input.pointsEarnOnShipping,
            },
        });
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const cf = (_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) !== null && _a !== void 0 ? _a : ctx.channel.customFields) !== null && _b !== void 0 ? _b : {};
        return {
            level1Threshold: (_c = cf.level1Threshold) !== null && _c !== void 0 ? _c : DEFAULT_THRESHOLDS[0],
            level1Name: (_d = cf.level1Name) !== null && _d !== void 0 ? _d : DEFAULT_NAMES[0],
            level2Threshold: (_e = cf.level2Threshold) !== null && _e !== void 0 ? _e : DEFAULT_THRESHOLDS[1],
            level2Name: (_f = cf.level2Name) !== null && _f !== void 0 ? _f : DEFAULT_NAMES[1],
            level3Threshold: (_g = cf.level3Threshold) !== null && _g !== void 0 ? _g : DEFAULT_THRESHOLDS[2],
            level3Name: (_h = cf.level3Name) !== null && _h !== void 0 ? _h : DEFAULT_NAMES[2],
            level4Threshold: (_j = cf.level4Threshold) !== null && _j !== void 0 ? _j : DEFAULT_THRESHOLDS[3],
            level4Name: (_k = cf.level4Name) !== null && _k !== void 0 ? _k : DEFAULT_NAMES[3],
            level5Threshold: (_l = cf.level5Threshold) !== null && _l !== void 0 ? _l : DEFAULT_THRESHOLDS[4],
            level5Name: (_m = cf.level5Name) !== null && _m !== void 0 ? _m : DEFAULT_NAMES[4],
            pointsEarnRatio: (_o = cf.pointsEarnRatio) !== null && _o !== void 0 ? _o : 1,
            pointsEarnOnShipping: (_p = cf.pointsEarnOnShipping) !== null && _p !== void 0 ? _p : false,
        };
    }
    // ===== Internal helpers =====
    async applyPointsChange(ctx, customerId, delta, type, orderId, remark) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a, _b;
            const repo = this.connection.getRepository(txCtx, core_1.Customer);
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
            history.channelId = txCtx.channelId;
            history.channels = [txCtx.channel];
            await this.connection.getRepository(txCtx, member_points_history_entity_1.MemberPointsHistory).save(history);
            return balanceAfter;
        });
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
    getLevelThresholds(ctx) {
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
        const { names } = this.getLevelThresholds(ctx);
        return names[Math.min(Math.max(level, 1), 5) - 1];
    }
    getNextLevel(ctx, level) {
        if (level >= 5) {
            return { threshold: null, name: null };
        }
        const { thresholds, names } = this.getLevelThresholds(ctx);
        return { threshold: thresholds[level], name: names[level] };
    }
};
exports.MemberLevelService = MemberLevelService;
exports.MemberLevelService = MemberLevelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService,
        core_1.ChannelService])
], MemberLevelService);
//# sourceMappingURL=member-level.service.js.map