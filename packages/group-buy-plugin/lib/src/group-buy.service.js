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
exports.GroupBuyService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const group_buy_activity_entity_1 = require("./group-buy-activity.entity");
const group_buy_order_entity_1 = require("./group-buy-order.entity");
const ALLOWED_UPDATE_FIELDS = [
    'name',
    'description',
    'startAt',
    'endAt',
    'targetCount',
    'maxCount',
    'groupPrice',
    'leaderDiscount',
    'leaderRewardType',
    'productId',
    'variantId',
    'autoConfirm',
    'allowJoinAfterComplete',
    'status',
];
let GroupBuyService = class GroupBuyService {
    constructor(connection, listQueryBuilder, channelService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.channelService = channelService;
        this.stockReserveService = null;
        this.stockPrewarmService = null;
    }
    init(injector) {
        try {
            const { StockReserveService, StockPrewarmService } = require('@vendure/redis-stock-plugin');
            this.stockReserveService = injector.get(StockReserveService);
            this.stockPrewarmService = injector.get(StockPrewarmService);
        }
        catch (_a) {
            // RedisStockPlugin not installed, use DB fallback
        }
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(group_buy_activity_entity_1.GroupBuyActivity, options, {
            ctx,
            relations: ['channels'],
            channelId: ctx.channelId,
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findOne(ctx, id) {
        const result = await this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity).findOne({
            where: { id: id },
            relations: { channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async create(ctx, input) {
        const repo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
        const activity = new group_buy_activity_entity_1.GroupBuyActivity(input);
        activity.channels = [ctx.channel];
        const saved = await repo.save(activity);
        if (this.stockPrewarmService && saved.status === 'active') {
            await this.stockPrewarmService.prewarm(`group-buy:${saved.id}`, saved.targetCount - saved.currentCount);
        }
        return saved;
    }
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
        const activity = await repo.findOne({ where: { id: input.id } });
        if (!activity) {
            throw new core_1.UserInputError(`GroupBuyActivity with id ${input.id} not found`);
        }
        const patch = {};
        for (const key of ALLOWED_UPDATE_FIELDS) {
            if (input[key] !== undefined) {
                patch[key] = input[key];
            }
        }
        Object.assign(activity, patch);
        return repo.save(activity);
    }
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
        await repo.delete(id);
    }
    async joinGroupBuy(ctx, activityId, orderId, isLeader) {
        var _a;
        const activityRepo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
        const orderRepo = this.connection.getRepository(ctx, group_buy_order_entity_1.GroupBuyOrder);
        await this.connection.startTransaction(ctx);
        try {
            const activity = await activityRepo.findOne({ where: { id: activityId } });
            if (!activity) {
                throw new core_1.UserInputError(`GroupBuyActivity with id ${activityId} not found`);
            }
            if (activity.status !== 'active') {
                throw new core_1.UserInputError('Activity is not active');
            }
            const now = new Date();
            if (activity.startAt && now < activity.startAt) {
                throw new core_1.UserInputError('Group buy activity has not started yet');
            }
            if (activity.endAt && now > activity.endAt) {
                throw new core_1.UserInputError('Group buy activity has ended');
            }
            if ((_a = this.stockReserveService) === null || _a === void 0 ? void 0 : _a.isAvailable) {
                const remaining = await this.stockReserveService.reserveStock(`group-buy:${activityId}`, 1);
                if (remaining < 0) {
                    throw new core_1.UserInputError('Activity is already full');
                }
            }
            else {
                if (activity.currentCount >= activity.targetCount && !activity.allowJoinAfterComplete) {
                    throw new core_1.UserInputError('Activity is already full');
                }
            }
            const groupBuyOrder = new group_buy_order_entity_1.GroupBuyOrder({
                groupBuyActivityId: String(activityId),
                orderId: String(orderId),
                isLeader,
                status: 'pending',
            });
            const savedOrder = await orderRepo.save(groupBuyOrder);
            activity.currentCount += 1;
            if (activity.currentCount >= activity.targetCount) {
                activity.status = 'completed';
            }
            await activityRepo.save(activity);
            await this.connection.commitOpenTransaction(ctx);
            return savedOrder;
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }
    async findActiveByVariant(ctx, variantId) {
        const repo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
        const qb = repo.createQueryBuilder('gba');
        qb.innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId });
        qb.where('gba.variantId = :variantId', { variantId: variantId });
        qb.andWhere('gba.status = :status', { status: 'active' });
        return qb.getMany();
    }
    async findActive(ctx) {
        const repo = this.connection.getRepository(ctx, group_buy_activity_entity_1.GroupBuyActivity);
        const now = new Date();
        return repo
            .createQueryBuilder('gba')
            .innerJoin('gba.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('gba.status = :status', { status: 'active' })
            .andWhere('gba.startAt <= :now', { now })
            .andWhere('gba.endAt >= :now', { now })
            .getMany();
    }
};
exports.GroupBuyService = GroupBuyService;
exports.GroupBuyService = GroupBuyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.ChannelService])
], GroupBuyService);
//# sourceMappingURL=group-buy.service.js.map