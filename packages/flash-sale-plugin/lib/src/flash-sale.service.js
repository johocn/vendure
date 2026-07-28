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
/**
 * update() 允许写入的字段白名单。
 * 显式过滤 soldCount/totalStock/status 等敏感字段，避免被外部 input 篡改。
 */
const UPDATE_ALLOWED_FIELDS = [
    'name',
    'startAt',
    'endAt',
    'flashPrice',
    'totalStock',
    'limitPerUser',
    'productId',
    'variantId',
];
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
            throw new core_1.UserInputError(`FlashSaleActivity with id ${input.id} not found`);
        }
        // 字段白名单：禁止外部 input 篡改 soldCount/status 等内部字段
        for (const key of UPDATE_ALLOWED_FIELDS) {
            if (key in input) {
                activity[key] = input[key];
            }
        }
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
            // DB fallback：原子 UPDATE 实现 check + reserve，避免并发超卖
            const reserved = await this.reserveStockAtomic(ctx, activityId, 1);
            if (!reserved) {
                return { eligible: false, reason: 'Stock sold out' };
            }
        }
        const existingOrders = await this.orderService.findByCustomerId(ctx, customerId);
        const flashSaleOrders = existingOrders.items.filter((o) => { var _a; return ((_a = o.customFields) === null || _a === void 0 ? void 0 : _a.flashSaleActivityId) === activityId && o.state !== 'Cancelled'; });
        if (flashSaleOrders.length >= activity.limitPerUser) {
            if ((_b = this.stockReserveService) === null || _b === void 0 ? void 0 : _b.isAvailable) {
                await this.stockReserveService.releaseStock(`flash-sale:${activityId}`, 1);
            }
            else {
                // DB fallback：资格未通过，回滚上面原子预占的 1 单位
                await this.releaseStockAtomic(ctx, activityId, 1);
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
        var _a;
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        // 原子 UPDATE：soldCount += quantity 仅在未超 totalStock 时生效
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ soldCount: () => `soldCount + ${quantity}` })
            .where('id = :id AND soldCount + :qty <= totalStock', { id: activityId, qty: quantity })
            .execute();
        if (((_a = result.affected) !== null && _a !== void 0 ? _a : 0) === 0) {
            core_1.Logger.warn(`FlashSaleActivity ${activityId}: soldCount + ${quantity} would exceed totalStock, increment skipped`, constants_1.loggerCtx);
        }
        const activity = await this.findOne(ctx, activityId);
        if (activity && activity.soldCount >= activity.totalStock) {
            activity.status = 'ended';
            await repo.save(activity);
            core_1.Logger.info(`FlashSaleActivity ${activityId} ended due to stock depletion`, constants_1.loggerCtx);
        }
    }
    /**
     * 订单取消时回滚库存：Redis 路径走 StockReserveService，DB 路径走原子 UPDATE。
     */
    async releaseStock(ctx, activityId, quantity) {
        var _a;
        if ((_a = this.stockReserveService) === null || _a === void 0 ? void 0 : _a.isAvailable) {
            await this.stockReserveService.releaseStock(`flash-sale:${activityId}`, quantity);
        }
        else {
            await this.releaseStockAtomic(ctx, activityId, quantity);
        }
    }
    /**
     * DB fallback 原子预占：UPDATE ... SET soldCount = soldCount + quantity
     * WHERE id = ? AND soldCount + quantity <= totalStock。
     * 返回是否成功扣减（affected > 0）。
     */
    async reserveStockAtomic(ctx, activityId, quantity) {
        var _a;
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ soldCount: () => `soldCount + ${quantity}` })
            .where('id = :id AND soldCount + :qty <= totalStock', { id: activityId, qty: quantity })
            .execute();
        return ((_a = result.affected) !== null && _a !== void 0 ? _a : 0) > 0;
    }
    /**
     * DB fallback 原子回滚：资格未通过或订单取消时，回滚预占的库存。
     * 使用 WHERE soldCount - quantity >= 0 防止负数。
     */
    async releaseStockAtomic(ctx, activityId, quantity) {
        const repo = this.connection.getRepository(ctx, flash_sale_activity_entity_1.FlashSaleActivity);
        await repo
            .createQueryBuilder()
            .update()
            .set({ soldCount: () => `soldCount - ${quantity}` })
            .where('id = :id AND soldCount - :qty >= 0', { id: activityId, qty: quantity })
            .execute();
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