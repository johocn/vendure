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
exports.FlashSaleService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const flash_sale_activity_entity_1 = require("./flash-sale-activity.entity");
let FlashSaleService = class FlashSaleService {
    constructor(connection, listQueryBuilder, orderService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.orderService = orderService;
        this.stockReserveService = null;
    }
    init(injector) {
        try {
            const { StockReserveService } = require('@vendure/redis-stock-plugin');
            this.stockReserveService = injector.get(StockReserveService);
        }
        catch (_a) {
            // RedisStockPlugin not installed, use DB fallback
        }
    }
    async findAll(ctx, options) {
        return this.listQueryBuilder
            .build(flash_sale_activity_entity_1.FlashSaleActivity, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findOne(ctx, id) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        const result = await repo.findOne({
            where: { id: id },
            relations: { channels: true },
        });
        return result !== null && result !== void 0 ? result : undefined;
    }
    async create(ctx, input) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        const activity = new flash_sale_activity_entity_1.FlashSaleActivity(input);
        activity.channels = [ctx.channel];
        const now = new Date();
        if (activity.startAt && now >= activity.startAt) {
            activity.status = 'active';
        }
        else {
            activity.status = 'upcoming';
        }
        return repo.save(activity);
    }
    async update(ctx, input) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        const activity = await repo.findOne({ where: { id: input.id } });
        if (!activity) {
            throw new Error(`FlashSaleActivity with id ${input.id} not found`);
        }
        Object.assign(activity, input);
        return repo.save(activity);
    }
    async delete(ctx, id) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        await repo.delete(id);
    }
    async checkEligibility(ctx, activityId, customerId) {
        var _a, _b;
        const activity = await this.findOne(ctx, activityId);
        if (!activity) {
            return { eligible: false, reason: 'Activity not found' };
        }
        const now = new Date();
        if (now < activity.startAt) {
            return { eligible: false, reason: 'Activity has not started' };
        }
        if (now > activity.endAt) {
            return { eligible: false, reason: 'Activity has ended' };
        }
        if ((_a = this.stockReserveService) === null || _a === void 0 ? void 0 : _a.isAvailable) {
            const remaining = await this.stockReserveService.reserveStock(`flash-sale:${activityId}`, 1);
            if (remaining < 0) {
                return { eligible: false, reason: 'Stock sold out' };
            }
        }
        else {
            if (activity.soldCount >= activity.totalStock) {
                return { eligible: false, reason: 'Stock sold out' };
            }
        }
        const existingOrders = await this.orderService.findByCustomerId(ctx, customerId);
        const flashSaleOrders = existingOrders.items.filter((o) => { var _a; return ((_a = o.customFields) === null || _a === void 0 ? void 0 : _a.flashSaleActivityId) === activityId && o.state !== 'Cancelled'; });
        if (flashSaleOrders.length >= activity.limitPerUser) {
            if ((_b = this.stockReserveService) === null || _b === void 0 ? void 0 : _b.isAvailable) {
                await this.stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
            }
            return { eligible: false, reason: 'Purchase limit exceeded' };
        }
        return { eligible: true };
    }
    async findActive(ctx) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        const now = new Date();
        return repo
            .createQueryBuilder('fsa')
            .innerJoin('fsa.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('fsa.status = :status', { status: 'active' })
            .andWhere('fsa.startAt <= :now', { now })
            .andWhere('fsa.endAt >= :now', { now })
            .getMany();
    }
    async findActiveByVariant(ctx, variantId) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        const now = new Date();
        const result = await repo
            .createQueryBuilder('fsa')
            .innerJoin('fsa.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('fsa.variantId = :variantId', { variantId: variantId })
            .andWhere('fsa.status = :status', { status: 'active' })
            .andWhere('fsa.startAt <= :now', { now })
            .andWhere('fsa.endAt >= :now', { now })
            .getOne();
        return result !== null && result !== void 0 ? result : undefined;
    }
    async incrementSoldCount(ctx, activityId, quantity) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        await repo.increment({ id: activityId }, 'soldCount', quantity);
        const activity = await this.findOne(ctx, activityId);
        if (activity && activity.soldCount >= activity.totalStock) {
            activity.status = 'ended';
            await repo.save(activity);
            core_1.Logger.info(`FlashSaleActivity ${activityId} ended due to stock depletion`, constants_1.loggerCtx);
        }
    }
};
exports.FlashSaleService = FlashSaleService;
exports.FlashSaleService = FlashSaleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.OrderService])
], FlashSaleService);
//# sourceMappingURL=flash-sale.service.js.map