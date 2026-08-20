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
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
// 不支持 pessimistic_write 锁的驱动（sqljs 内存库用于测试，better-sqlite3 同步驱动无锁）
const NO_LOCK_DRIVERS = ['sqljs', 'better-sqlite3'];
const constants_1 = require("./constants");
const member_points_history_entity_1 = require("./member-points-history.entity");
const DEFAULT_THRESHOLDS = [0, 1000, 5000, 20000, 100000];
const DEFAULT_NAMES = ['普通会员', '银卡会员', '金卡会员', '白金会员', '钻石会员'];
let MemberLevelService = class MemberLevelService {
    constructor(connection, listQueryBuilder, customerService, channelService, configService, orderService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
        this.channelService = channelService;
        this.configService = configService;
        this.orderService = orderService;
        const driverType = this.configService.dbConnectionOptions.type;
        this.supportsPessimisticLock = !NO_LOCK_DRIVERS.includes(driverType);
    }
    /**
     * 折算率：多少积分抵 1 元。读 Channel.pointsPerYuan，未配置用默认 100（100 积分抵 1 元）。
     */
    getPointsPerYuan(ctx) {
        var _a, _b, _c;
        return (_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.pointsPerYuan) !== null && _c !== void 0 ? _c : 100;
    }
    /**
     * 积分有效期（天），0=不过期。读 Channel.pointsExpireDays。
     */
    getPointsExpireDays(ctx) {
        var _a, _b, _c;
        return (_c = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.pointsExpireDays) !== null && _c !== void 0 ? _c : 0;
    }
    /**
     * 包装 customer 查询：驱动支持时加 pessimistic_write 锁，sqljs/better-sqlite3 跳过锁
     * 并发安全在生产驱动（mysql/postgres）由悲观锁保证；sqljs 测试环境降级为无锁。
     */
    async loadCustomerForUpdate(repo, customerId) {
        const qb = repo.createQueryBuilder('customer').where('customer.id = :id', {
            id: customerId,
        });
        if (this.supportsPessimisticLock) {
            qb.setLock('pessimistic_write');
        }
        return qb.getOne();
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
            const customer = await this.loadCustomerForUpdate(repo, customerId);
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
    async addPoints(ctx, customerId, amount, orderId, remark, expiresAt) {
        const amt = Math.floor(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new core_1.UserInputError('amount must be a positive integer');
        }
        return this.applyPointsChange(ctx, customerId, amt, member_points_history_entity_1.PointsHistoryType.EARN, orderId, remark, expiresAt);
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
    /**
     * 幂等判重：按订单 + 明细类型 + remark 前缀检查是否已有同源积分明细
     * （如取消回退 `order_cancelled:` / 退款回退 `refund_settled:` / 过期 `earn_expired:`）。
     */
    async hasPointsRemark(ctx, customerId, orderId, type, remarkPrefix) {
        const repo = this.connection.getRepository(ctx, member_points_history_entity_1.MemberPointsHistory);
        const count = await repo.count({
            where: {
                customerId: customerId,
                orderId: Number(orderId),
                type,
                remark: (0, typeorm_1.Like)(`${remarkPrefix}%`),
            },
        });
        return count > 0;
    }
    /**
     * 积分抵现（绑定即扣）：
     * 1. 校验登录、订单归属、points 为正整数
     * 2. 折算：discountAmount = floor(points / pointsPerYuan) * 100（分）
     * 3. 校验：折算金额 > 0 且 < 订单 subTotal（不能全免单）
     * 4. 原子扣减积分余额（pessimistic lock 或 sqljs 降级）+ 写 SPEND 明细
     * 5. 写订单 customFields（pointsToRedeem / pointsRedeemAmount）→ 重算价格触发积分抵现 Promotion
     * 6. 幂等：同一订单已绑定相同积分直接返回当前订单
     */
    async redeemPoints(ctx, points) {
        var _a, _b, _c, _d;
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new core_1.UserInputError('Not authenticated');
        }
        const amt = Math.floor(points);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new core_1.UserInputError('points must be a positive integer');
        }
        const customer = await this.customerService.findOneByUserId(ctx, userId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', userId);
        }
        const order = await this.orderService.getActiveOrderForUser(ctx, userId);
        if (!order) {
            throw new core_1.UserInputError('No active order found');
        }
        // 归属校验：用 customer.user.id（登录 User 主键），勿用 customer.id
        if (((_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) !== userId) {
            throw new core_1.UserInputError('You can only redeem points on your own order');
        }
        // 幂等：同一订单已绑定相同积分直接返回
        if (((_c = order === null || order === void 0 ? void 0 : order.customFields) === null || _c === void 0 ? void 0 : _c.pointsToRedeem) === amt) {
            return this.orderService.findOne(ctx, order.id, [
                'lines',
                'lines.productVariant',
            ]);
        }
        const pointsPerYuan = this.getPointsPerYuan(ctx);
        const discountAmount = Math.floor(amt / pointsPerYuan) * 100;
        const subTotal = (_d = order.subTotal) !== null && _d !== void 0 ? _d : 0;
        if (discountAmount <= 0) {
            throw new core_1.UserInputError('Redeemed amount is zero');
        }
        if (discountAmount >= subTotal) {
            throw new core_1.UserInputError('Redeemed amount must be less than order subtotal');
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a, _b;
            const repo = this.connection.getRepository(txCtx, core_1.Customer);
            const locked = await this.loadCustomerForUpdate(repo, customer.id);
            if (!locked) {
                throw new core_1.EntityNotFoundError('Customer', customer.id);
            }
            const ccf = (_a = locked.customFields) !== null && _a !== void 0 ? _a : {};
            const balance = (_b = ccf.points) !== null && _b !== void 0 ? _b : 0;
            if (balance < amt) {
                throw new core_1.UserInputError('Insufficient points');
            }
            ccf.points = balance - amt;
            await repo.save(locked);
            const history = new member_points_history_entity_1.MemberPointsHistory({
                customerId: customer.id,
                type: member_points_history_entity_1.PointsHistoryType.SPEND,
                amount: -amt,
                balanceBefore: balance,
                balanceAfter: balance - amt,
                orderId: Number(order.id),
                remark: 'points_redeem',
            });
            history.channelId = txCtx.channelId;
            history.channels = [txCtx.channel];
            await this.connection.getRepository(txCtx, member_points_history_entity_1.MemberPointsHistory).save(history);
            // 写订单字段 → 触发积分抵现 Promotion 折让 → 重算价格
            const updatedOrder = await this.orderService.updateCustomFields(txCtx, order.id, {
                pointsToRedeem: amt,
                pointsRedeemAmount: discountAmount,
            });
            await this.orderService.applyPriceAdjustments(txCtx, updatedOrder);
            core_1.Logger.info(`Customer ${customer.id} redeemed ${amt} points (${discountAmount}分) on order ${order.id}`, constants_1.loggerCtx);
            return this.orderService.findOne(txCtx, order.id, [
                'lines',
                'lines.productVariant',
            ]);
        });
    }
    /**
     * 取消回退：订单取消时按已抵扣积分全额回退（EARN 明细）+ 清空订单字段。
     * 幂等：该订单已有 `order_cancelled:` EARN 明细则跳过。
     */
    async releasePointsByOrder(ctx, order) {
        var _a, _b, _c;
        const pointsToRedeem = (_b = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.pointsToRedeem) !== null && _b !== void 0 ? _b : 0;
        if (pointsToRedeem <= 0)
            return;
        const customerId = (_c = order === null || order === void 0 ? void 0 : order.customer) === null || _c === void 0 ? void 0 : _c.id;
        if (customerId == null)
            return;
        if (await this.hasPointsRemark(ctx, customerId, order.id, member_points_history_entity_1.PointsHistoryType.EARN, 'order_cancelled:')) {
            return;
        }
        await this.connection.withTransaction(ctx, async (txCtx) => {
            await this.addPoints(txCtx, customerId, pointsToRedeem, order.id, `order_cancelled:${order.id}`);
            await this.orderService.updateCustomFields(txCtx, order.id, {
                pointsToRedeem: 0,
                pointsRedeemAmount: 0,
            });
        });
        core_1.Logger.info(`Order ${order.id} cancelled: released ${pointsToRedeem} points to customer ${customerId}`, constants_1.loggerCtx);
    }
    /**
     * 退款按比例回退：Refund Settled 时按 floor(pointsToRedeem × refund.total / order.totalWithTax)
     * 回退已抵扣积分（EARN 明细）。幂等：该订单已有 `refund_settled:` EARN 明细则跳过。
     *
     * 口径说明：refund.total 是含税金额（proratedUnitPriceWithTax + shipping/withTax），
     * 必须用 order.totalWithTax 作分母保持同口径，否则含税价下比例 ≠ 1，退回积分会多退。
     */
    async refundPointsByOrder(ctx, order, refund) {
        var _a, _b, _c, _d, _e, _f;
        // 事件携带的 order 不一定加载了 customer / customFields，这里用 OrderService 按 id 重载
        // 保证能读到归属 customer 与 pointsToRedeem（退款事件 order.customer 为空是常见坑）。
        const reloaded = (_a = (await this.orderService.findOne(ctx, order.id, ['customer']))) !== null && _a !== void 0 ? _a : order;
        const pointsToRedeem = (_c = (_b = reloaded === null || reloaded === void 0 ? void 0 : reloaded.customFields) === null || _b === void 0 ? void 0 : _b.pointsToRedeem) !== null && _c !== void 0 ? _c : 0;
        if (pointsToRedeem <= 0)
            return;
        const customerId = (_d = reloaded === null || reloaded === void 0 ? void 0 : reloaded.customer) === null || _d === void 0 ? void 0 : _d.id;
        if (customerId == null)
            return;
        const orderTotal = (_e = reloaded.totalWithTax) !== null && _e !== void 0 ? _e : 0;
        const refundAmount = (_f = refund.total) !== null && _f !== void 0 ? _f : 0;
        if (orderTotal <= 0 || refundAmount <= 0)
            return;
        const pointsToReturn = Math.floor((pointsToRedeem * refundAmount) / orderTotal);
        if (pointsToReturn <= 0)
            return;
        if (await this.hasPointsRemark(ctx, customerId, order.id, member_points_history_entity_1.PointsHistoryType.EARN, 'refund_settled:')) {
            return;
        }
        await this.connection.withTransaction(ctx, async (txCtx) => {
            await this.addPoints(txCtx, customerId, pointsToReturn, order.id, `refund_settled:${refund.id}`);
        });
        core_1.Logger.info(`Refund ${refund.id} for order ${order.id}: returned ${pointsToReturn} points to customer ${customerId}`, constants_1.loggerCtx);
    }
    /**
     * 过期清理：扫描本渠道 type=EARN 且 expiresAt 已过且 amount>0 的明细，
     * 逐条幂等扣减余额并写 EXPIRE 明细（remark=`earn_expired:<earnId>`）。返回处理条数。
     */
    async expireEarnedPoints(ctx) {
        var _a, _b;
        // 从 DB 重新拉取 channel 配置（不能依赖 ctx.channel 快照：admin/定时上下文可能持有
        // 早于 pointsExpireDays 配置更新的快照，否则 expireDays 恒为默认 0 导致永远扫不到过期单）。
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const expireDays = (_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a.pointsExpireDays) !== null && _b !== void 0 ? _b : 0;
        if (expireDays <= 0)
            return 0;
        const now = new Date();
        const repo = this.connection.getRepository(ctx, member_points_history_entity_1.MemberPointsHistory);
        const expired = await repo
            .createQueryBuilder('mph')
            .where('mph.type = :type', { type: member_points_history_entity_1.PointsHistoryType.EARN })
            .andWhere('mph.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('mph.expiresAt IS NOT NULL')
            .andWhere('mph.expiresAt < :now', { now })
            .andWhere('mph.amount > 0')
            .getMany();
        let count = 0;
        for (const record of expired) {
            const already = await repo.count({
                where: {
                    customerId: record.customerId,
                    type: member_points_history_entity_1.PointsHistoryType.EXPIRE,
                    remark: `earn_expired:${record.id}`,
                },
            });
            if (already > 0)
                continue;
            await this.connection.withTransaction(ctx, async (txCtx) => {
                var _a, _b;
                const customerRepo = this.connection.getRepository(txCtx, core_1.Customer);
                const customer = await this.loadCustomerForUpdate(customerRepo, record.customerId);
                if (!customer)
                    return;
                const ccf = (_a = customer.customFields) !== null && _a !== void 0 ? _a : {};
                const balance = (_b = ccf.points) !== null && _b !== void 0 ? _b : 0;
                const deduct = Math.min(record.amount, balance);
                if (deduct <= 0)
                    return;
                ccf.points = balance - deduct;
                await customerRepo.save(customer);
                const history = new member_points_history_entity_1.MemberPointsHistory({
                    customerId: record.customerId,
                    type: member_points_history_entity_1.PointsHistoryType.EXPIRE,
                    amount: -deduct,
                    balanceBefore: balance,
                    balanceAfter: balance - deduct,
                    orderId: null,
                    remark: `earn_expired:${record.id}`,
                });
                history.channelId = txCtx.channelId;
                history.channels = [txCtx.channel];
                await this.connection.getRepository(txCtx, member_points_history_entity_1.MemberPointsHistory).save(history);
            });
            count++;
        }
        if (count > 0) {
            core_1.Logger.info(`Points expiration: expired ${count} records`, constants_1.loggerCtx);
        }
        return count;
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
    async applyPointsChange(ctx, customerId, delta, type, orderId, remark, expiresAt) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            var _a, _b;
            const repo = this.connection.getRepository(txCtx, core_1.Customer);
            const customer = await this.loadCustomerForUpdate(repo, customerId);
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
                expiresAt: expiresAt !== null && expiresAt !== void 0 ? expiresAt : null,
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
        core_1.ChannelService,
        core_1.ConfigService,
        core_1.OrderService])
], MemberLevelService);
//# sourceMappingURL=member-level.service.js.map