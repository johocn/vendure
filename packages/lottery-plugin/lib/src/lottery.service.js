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
exports.LotteryService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const constants_1 = require("./constants");
const lottery_prize_entity_1 = require("./lottery-prize.entity");
const lottery_record_entity_1 = require("./lottery-record.entity");
let LotteryService = class LotteryService {
    constructor(connection, listQueryBuilder, customerService, 
    /** 积分桥软依赖（checkin-plugin 同款直注，需与 MemberLevelPlugin 同容器） */
    memberService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
        this.memberService = memberService;
    }
    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径）。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
    /**
     * 参与开奖的奖品全集（shop 展示与 draw 共用同一份，保证 prizeIndex 同源）：
     * enabled + 当前渠道或全渠道 + 库存可用（null=不限量），按 sort ASC/id ASC 排序。
     * weight <= 0 的奖项保留在下标序列中（仅展示，不参与加权抽取）。
     */
    enabledPrizes(ctx) {
        return this.connection
            .getRepository(ctx, lottery_prize_entity_1.LotteryPrize)
            .createQueryBuilder('prize')
            .where('prize.enabled = :enabled', { enabled: true })
            .andWhere('(prize.channelId IS NULL OR prize.channelId = :channelId)', {
            channelId: ctx.channelId,
        })
            .andWhere('(prize.stock IS NULL OR prize.stock > 0)')
            .orderBy('prize.sort', 'ASC')
            .addOrderBy('prize.id', 'ASC')
            .getMany();
    }
    /** shop：九宫格奖品列表（启用中，含 consume；顺序与开奖 prizeIndex 同源）。未登录可访问。 */
    async myPrizes(ctx) {
        return this.enabledPrizes(ctx);
    }
    /**
     * 服务端开奖：按权重随机取奖 → spendPoints 桥扣积分（余额不足抛 UserInputError，事务回滚）
     * → 库存原子递减 → 落抽奖记录。resolver 端 @Transaction() 包裹。
     */
    async draw(ctx) {
        const customer = await this.requireCustomer(ctx);
        const prizes = await this.enabledPrizes(ctx);
        if (!prizes.length) {
            throw new core_1.UserInputError('Lottery is not configured');
        }
        const total = prizes.reduce((s, p) => s + (p.weight > 0 ? p.weight : 0), 0);
        if (total <= 0) {
            throw new core_1.UserInputError('Lottery is not configured');
        }
        let roll = Math.floor(Math.random() * total);
        let picked = prizes[prizes.length - 1];
        let prizeIndex = prizes.length - 1;
        for (let i = 0; i < prizes.length; i++) {
            if (prizes[i].weight <= 0) {
                continue;
            }
            roll -= prizes[i].weight;
            if (roll < 0) {
                picked = prizes[i];
                prizeIndex = i;
                break;
            }
        }
        // 先扣积分（不足即抛、整体回滚），consume=0 视为免费抽奖
        if (picked.consume > 0) {
            const balance = await this.memberService.spendPoints(ctx, customer.id, picked.consume, null, '积分抽奖');
            core_1.Logger.info(`Lottery draw customer ${customer.id} spent ${picked.consume} points, balance ${balance}`, constants_1.loggerCtx);
        }
        // 库存原子递减（camelCase 列必须双引号：postgres 生产 + sqljs 测试双兼容）
        if (picked.stock != null) {
            const decrement = await this.connection
                .getRepository(ctx, lottery_prize_entity_1.LotteryPrize)
                .createQueryBuilder()
                .update(lottery_prize_entity_1.LotteryPrize)
                .set({ stock: () => '"stock" - 1' })
                .where('id = :id', { id: picked.id })
                .andWhere('"stock" > 0')
                .execute();
            if (!decrement.affected) {
                throw new core_1.UserInputError('Lottery prize out of stock');
            }
        }
        const repo = this.connection.getRepository(ctx, lottery_record_entity_1.LotteryRecord);
        await repo.save(repo.create({
            customerId: customer.id,
            prizeId: picked.id,
            prizeName: picked.name,
            prizeImage: picked.image,
            consume: picked.consume,
            channelId: ctx.channelId,
            createdAt: new Date(),
        }));
        return { prizeIndex, prize: picked };
    }
    /** shop：我的抽奖记录（customerId + channelId 隔离，id DESC）。 */
    async myRecords(ctx, options) {
        const customer = await this.requireCustomer(ctx);
        return this.listQueryBuilder
            .build(lottery_record_entity_1.LotteryRecord, { skip: options === null || options === void 0 ? void 0 : options.skip, take: options === null || options === void 0 ? void 0 : options.take }, {
            ctx,
            where: { customerId: customer.id, channelId: ctx.channelId },
            orderBy: { id: 'DESC' },
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /** admin：奖品分页（当前渠道或全渠道，sort ASC/id ASC）。 */
    async adminPrizes(ctx, options) {
        const qb = this.listQueryBuilder.build(lottery_prize_entity_1.LotteryPrize, { skip: options === null || options === void 0 ? void 0 : options.skip, take: options === null || options === void 0 ? void 0 : options.take }, { ctx, entityAlias: 'prize', orderBy: { sort: 'ASC', id: 'ASC' } });
        qb.andWhere('(prize.channelId IS NULL OR prize.channelId = :channelId)', { channelId: ctx.channelId });
        return qb.getManyAndCount().then(([items, totalItems]) => ({ items, totalItems }));
    }
    /** admin：全量抽奖记录分页（id DESC）。 */
    async adminRecords(ctx, options) {
        return this.listQueryBuilder
            .build(lottery_record_entity_1.LotteryRecord, { skip: options === null || options === void 0 ? void 0 : options.skip, take: options === null || options === void 0 ? void 0 : options.take }, { ctx, orderBy: { id: 'DESC' } })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /** admin：创建奖品（归属当前渠道）。 */
    async createPrize(ctx, input) {
        var _a, _b, _c, _d, _e, _f;
        const name = (_b = (_a = input.name) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        if (!name) {
            throw new core_1.UserInputError('name is required');
        }
        const weight = Math.floor(input.weight);
        const consume = Math.floor(input.consume);
        if (!Number.isFinite(weight) || weight < 0) {
            throw new core_1.UserInputError('weight must be a non-negative integer');
        }
        if (!Number.isFinite(consume) || consume < 0) {
            throw new core_1.UserInputError('consume must be a non-negative integer');
        }
        const repo = this.connection.getRepository(ctx, lottery_prize_entity_1.LotteryPrize);
        const saved = await repo.save(repo.create({
            name,
            image: (_c = input.image) !== null && _c !== void 0 ? _c : null,
            weight,
            consume,
            stock: (_d = input.stock) !== null && _d !== void 0 ? _d : null,
            enabled: (_e = input.enabled) !== null && _e !== void 0 ? _e : true,
            sort: (_f = input.sort) !== null && _f !== void 0 ? _f : 0,
            channelId: ctx.channelId,
        }));
        core_1.Logger.info(`LotteryPrize ${saved.id} created (weight=${saved.weight}, consume=${saved.consume})`, constants_1.loggerCtx);
        return saved;
    }
    /** admin：更新奖品（仅覆盖传入字段；image/stock 传 null 可清空）。 */
    async updatePrize(ctx, input) {
        const repo = this.connection.getRepository(ctx, lottery_prize_entity_1.LotteryPrize);
        const prize = await repo.findOne({ where: { id: input.id } });
        if (!prize) {
            throw new core_1.UserInputError(`LotteryPrize ${input.id} not found`);
        }
        if (input.name != null) {
            const name = input.name.trim();
            if (!name) {
                throw new core_1.UserInputError('name is required');
            }
            prize.name = name;
        }
        if (input.image !== undefined) {
            prize.image = input.image;
        }
        if (input.weight != null) {
            if (!Number.isFinite(input.weight) || input.weight < 0) {
                throw new core_1.UserInputError('weight must be a non-negative integer');
            }
            prize.weight = Math.floor(input.weight);
        }
        if (input.consume != null) {
            if (!Number.isFinite(input.consume) || input.consume < 0) {
                throw new core_1.UserInputError('consume must be a non-negative integer');
            }
            prize.consume = Math.floor(input.consume);
        }
        if (input.stock !== undefined) {
            prize.stock = input.stock;
        }
        if (input.enabled != null) {
            prize.enabled = input.enabled;
        }
        if (input.sort != null) {
            prize.sort = Math.floor(input.sort);
        }
        const saved = await repo.save(prize);
        core_1.Logger.info(`LotteryPrize ${saved.id} updated`, constants_1.loggerCtx);
        return saved;
    }
    /** admin：删除奖品。 */
    async deletePrize(ctx, id) {
        const repo = this.connection.getRepository(ctx, lottery_prize_entity_1.LotteryPrize);
        const prize = await repo.findOne({ where: { id } });
        if (!prize) {
            throw new core_1.UserInputError(`LotteryPrize ${id} not found`);
        }
        await repo.remove(prize);
        core_1.Logger.info(`LotteryPrize ${id} deleted`, constants_1.loggerCtx);
        return true;
    }
};
exports.LotteryService = LotteryService;
exports.LotteryService = LotteryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService,
        member_level_plugin_1.MemberLevelService])
], LotteryService);
//# sourceMappingURL=lottery.service.js.map