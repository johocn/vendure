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
exports.CouponService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const coupon_code_entity_1 = require("./coupon-code.entity");
const coupon_entity_1 = require("./coupon.entity");
/** 订单状态若处于以下集合之外，视为“已下单”（用于新人券判定）。 */
const NON_PLACED_STATES = ['Draft', 'AddingItems', 'ArrangingPayment', 'Cancelled'];
let CouponService = class CouponService {
    constructor(connection, listQueryBuilder, customerService, orderService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.customerService = customerService;
        this.orderService = orderService;
    }
    // ===== Admin CRUD =====
    async getCoupons(ctx, options) {
        const isSuperadmin = ctx.userHasPermissions([core_1.Permission.SuperAdmin]);
        const qb = this.listQueryBuilder
            .build(coupon_entity_1.Coupon, options, {
            ctx,
            relations: ['channels'],
        });
        if (!isSuperadmin) {
            // 租户管理员：看全局券 + 自己渠道的券
            qb.andWhere('(coupon.isGlobal = :isGlobal OR coupon.ownerChannelId = :channelId)', { isGlobal: true, channelId: ctx.channelId });
        }
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async getCoupon(ctx, id) {
        return this.connection.getRepository(ctx, coupon_entity_1.Coupon).findOne({
            where: { id: id },
            relations: ['channels'],
        });
    }
    async createCoupon(ctx, input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!input.name)
            throw new core_1.UserInputError('name is required');
        if (!input.couponType)
            throw new core_1.UserInputError('couponType is required');
        if (input.discountValue == null)
            throw new core_1.UserInputError('discountValue is required');
        if (!input.startAt || !input.endAt)
            throw new core_1.UserInputError('startAt and endAt are required');
        if (input.totalQuantity == null)
            throw new core_1.UserInputError('totalQuantity is required');
        const isSuperadmin = ctx.userHasPermissions([core_1.Permission.SuperAdmin]);
        const isGlobal = input.isGlobal === true && isSuperadmin;
        const coupon = new coupon_entity_1.Coupon({
            name: input.name,
            description: (_a = input.description) !== null && _a !== void 0 ? _a : null,
            couponType: input.couponType,
            discountValue: input.discountValue,
            minSpend: (_b = input.minSpend) !== null && _b !== void 0 ? _b : 0,
            maxDiscount: (_c = input.maxDiscount) !== null && _c !== void 0 ? _c : 0,
            startAt: input.startAt,
            endAt: input.endAt,
            totalQuantity: input.totalQuantity,
            claimedCount: 0,
            limitPerUser: (_d = input.limitPerUser) !== null && _d !== void 0 ? _d : 1,
            isActive: (_e = input.isActive) !== null && _e !== void 0 ? _e : true,
            applicableProductIds: (_f = input.applicableProductIds) !== null && _f !== void 0 ? _f : null,
            applicableCategoryIds: (_g = input.applicableCategoryIds) !== null && _g !== void 0 ? _g : null,
            isNewUserOnly: (_h = input.isNewUserOnly) !== null && _h !== void 0 ? _h : false,
        });
        coupon.isGlobal = isGlobal;
        coupon.ownerChannelId = isGlobal ? null : Number(ctx.channelId);
        coupon.channelId = Number(ctx.channelId);
        coupon.channels = [ctx.channel];
        return this.connection.getRepository(ctx, coupon_entity_1.Coupon).save(coupon);
    }
    /** updateCoupon 字段白名单：不允许修改 claimedCount / couponType / discountValue。 */
    async updateCoupon(ctx, id, input) {
        const repo = this.connection.getRepository(ctx, coupon_entity_1.Coupon);
        const coupon = await repo.findOne({ where: { id: id }, relations: ['channels'] });
        if (!coupon)
            throw new core_1.EntityNotFoundError('Coupon', id);
        // 租户不能修改全局券
        if (coupon.isGlobal && !ctx.userHasPermissions([core_1.Permission.SuperAdmin])) {
            throw new core_1.UserInputError('Cannot modify global coupon');
        }
        if (input.name != null)
            coupon.name = input.name;
        if (input.description != null)
            coupon.description = input.description;
        if (input.startAt != null)
            coupon.startAt = input.startAt;
        if (input.endAt != null)
            coupon.endAt = input.endAt;
        if (input.totalQuantity != null)
            coupon.totalQuantity = input.totalQuantity;
        if (input.limitPerUser != null)
            coupon.limitPerUser = input.limitPerUser;
        if (input.isActive != null)
            coupon.isActive = input.isActive;
        if (input.minSpend != null)
            coupon.minSpend = input.minSpend;
        if (input.maxDiscount != null)
            coupon.maxDiscount = input.maxDiscount;
        if (input.isNewUserOnly != null)
            coupon.isNewUserOnly = input.isNewUserOnly;
        return repo.save(coupon);
    }
    async deleteCoupon(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_entity_1.Coupon);
        const coupon = await repo.findOne({ where: { id: id } });
        if (!coupon)
            return false;
        // 租户不能删除全局券
        if (coupon.isGlobal && !ctx.userHasPermissions([core_1.Permission.SuperAdmin])) {
            throw new core_1.UserInputError('Cannot delete global coupon');
        }
        await repo.remove(coupon);
        return true;
    }
    /**
     * 租户启用全局优惠券：把当前渠道加入 coupon.channels。
     * 已启用时幂等返回。
     */
    async enableCouponForChannel(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_entity_1.Coupon);
        const coupon = await repo.findOne({ where: { id: id }, relations: ['channels'] });
        if (!coupon)
            throw new core_1.EntityNotFoundError('Coupon', id);
        if (!coupon.isGlobal) {
            throw new core_1.UserInputError('Only global coupons can be enabled/disabled per channel');
        }
        const alreadyEnabled = coupon.channels.some(ch => ch.id === ctx.channelId);
        if (!alreadyEnabled) {
            const channelRepo = this.connection.getRepository(ctx, core_1.Channel);
            const channel = await channelRepo.findOne({ where: { id: ctx.channelId } });
            if (channel) {
                coupon.channels.push(channel);
                await repo.save(coupon);
            }
        }
        return coupon;
    }
    /**
     * 租户禁用全局优惠券：把当前渠道从 coupon.channels 移除。
     * 已禁用时幂等返回。
     */
    async disableCouponForChannel(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_entity_1.Coupon);
        const coupon = await repo.findOne({ where: { id: id }, relations: ['channels'] });
        if (!coupon)
            throw new core_1.EntityNotFoundError('Coupon', id);
        if (!coupon.isGlobal) {
            throw new core_1.UserInputError('Only global coupons can be enabled/disabled per channel');
        }
        coupon.channels = coupon.channels.filter(ch => ch.id !== ctx.channelId);
        await repo.save(coupon);
        return coupon;
    }
    // ===== Shop: claim / list / validate / redeem / release =====
    /** 可领取的券：当前 channel、激活、活动期内、有库存。 */
    async getAvailableCoupons(ctx) {
        const now = new Date();
        const repo = this.connection.getRepository(ctx, coupon_entity_1.Coupon);
        return repo
            .createQueryBuilder('coupon')
            .leftJoinAndSelect('coupon.channels', 'channel')
            .where('channel.id = :channelId', { channelId: ctx.channelId })
            .andWhere('coupon.isActive = :active', { active: true })
            .andWhere('coupon.startAt <= :now', { now })
            .andWhere('coupon.endAt >= :now', { now })
            .andWhere('coupon.totalQuantity > coupon.claimedCount')
            .getMany();
    }
    async claimCoupon(ctx, couponId) {
        if (!ctx.activeUserId)
            throw new core_1.UnauthorizedError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        const coupon = await this.connection.getRepository(ctx, coupon_entity_1.Coupon).findOne({
            where: { id: couponId },
        });
        if (!coupon)
            throw new core_1.EntityNotFoundError('Coupon', couponId);
        if (!coupon.isActive)
            throw new core_1.UserInputError('Coupon is not active');
        const now = new Date();
        if (now < coupon.startAt || now > coupon.endAt) {
            throw new core_1.UserInputError('Coupon is not within active period');
        }
        if (coupon.claimedCount >= coupon.totalQuantity) {
            throw new core_1.UserInputError('Coupon out of stock');
        }
        const claimedRepo = this.connection.getRepository(ctx, coupon_code_entity_1.CouponCode);
        const claimedByUser = await claimedRepo.count({
            where: { couponId: Number(coupon.id), customerId: Number(customer.id) },
        });
        if (claimedByUser >= coupon.limitPerUser) {
            throw new core_1.UserInputError('Claim limit reached for this user');
        }
        if (coupon.isNewUserOnly) {
            const isNew = await this.isNewCustomer(ctx, customer.id);
            if (!isNew)
                throw new core_1.UserInputError('Coupon is for new users only');
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const couponRepo = this.connection.getRepository(txCtx, coupon_entity_1.Coupon);
            const lockedCoupon = await couponRepo
                .createQueryBuilder('coupon')
                .setLock('pessimistic_write')
                .where('coupon.id = :id', { id: coupon.id })
                .getOne();
            if (!lockedCoupon)
                throw new core_1.EntityNotFoundError('Coupon', couponId);
            if (lockedCoupon.claimedCount >= lockedCoupon.totalQuantity) {
                throw new core_1.UserInputError('Coupon out of stock');
            }
            lockedCoupon.claimedCount += 1;
            await couponRepo.save(lockedCoupon);
            const code = new coupon_code_entity_1.CouponCode({
                couponId: Number(coupon.id),
                customerId: Number(customer.id),
                code: this.generateCode(),
                status: constants_1.CouponCodeStatus.Unused,
                claimedAt: now,
            });
            code.channelId = Number(txCtx.channelId);
            code.channels = [txCtx.channel];
            const txClaimedRepo = this.connection.getRepository(txCtx, coupon_code_entity_1.CouponCode);
            return txClaimedRepo.save(code);
        });
    }
    async getMyCoupons(ctx, status) {
        if (!ctx.activeUserId)
            throw new core_1.UnauthorizedError();
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            return [];
        const repo = this.connection.getRepository(ctx, coupon_code_entity_1.CouponCode);
        const where = { customerId: customer.id };
        if (status)
            where.status = status;
        return repo.find({ where });
    }
    /** 校验券码可用性并计算折扣金额（不修改状态）。 */
    async validateCoupon(ctx, code, orderLines) {
        const couponCode = await this.connection
            .getRepository(ctx, coupon_code_entity_1.CouponCode)
            .findOne({ where: { code }, relations: [] });
        if (!couponCode) {
            return { valid: false, discountAmount: 0, error: 'Coupon code not found' };
        }
        if (couponCode.status !== constants_1.CouponCodeStatus.Unused) {
            return { valid: false, discountAmount: 0, error: `Coupon is ${couponCode.status}` };
        }
        const coupon = await this.connection
            .getRepository(ctx, coupon_entity_1.Coupon)
            .findOne({ where: { id: couponCode.couponId } });
        if (!coupon) {
            return { valid: false, discountAmount: 0, error: 'Coupon not found' };
        }
        if (!coupon.isActive) {
            return { valid: false, discountAmount: 0, error: 'Coupon is inactive' };
        }
        const now = new Date();
        if (now < coupon.startAt || now > coupon.endAt) {
            return { valid: false, discountAmount: 0, error: 'Coupon is out of active period' };
        }
        const orderSubtotal = orderLines.reduce((sum, l) => sum + l.lineTotal, 0);
        if (coupon.minSpend > 0 && orderSubtotal < coupon.minSpend) {
            return {
                valid: false,
                discountAmount: 0,
                error: `Order amount does not meet minSpend ${coupon.minSpend}`,
            };
        }
        const eligibleTotal = this.computeEligibleTotal(coupon, orderLines);
        if (eligibleTotal <= 0) {
            return { valid: false, discountAmount: 0, error: 'No eligible items in order' };
        }
        const discountAmount = this.computeDiscount(coupon, eligibleTotal);
        return { valid: true, discountAmount, error: null };
    }
    /** 核销：事务化，校验 + 标记 used。 */
    async redeemCoupon(ctx, code, orderId) {
        var _a;
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.collections',
        ]);
        if (!order)
            throw new core_1.EntityNotFoundError('Order', orderId);
        const orderLines = this.mapOrderToLines(order);
        const result = await this.validateCoupon(ctx, code, orderLines);
        if (!result.valid) {
            throw new core_1.UserInputError((_a = result.error) !== null && _a !== void 0 ? _a : 'Coupon is not valid');
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, coupon_code_entity_1.CouponCode);
            const locked = await repo
                .createQueryBuilder('cc')
                .setLock('pessimistic_write')
                .where('cc.code = :code', { code })
                .getOne();
            if (!locked)
                throw new core_1.EntityNotFoundError('CouponCode', code);
            if (locked.status !== constants_1.CouponCodeStatus.Unused) {
                throw new core_1.UserInputError(`Coupon is ${locked.status}`);
            }
            locked.status = constants_1.CouponCodeStatus.Used;
            locked.usedAt = new Date();
            locked.orderId = Number(orderId);
            const saved = await repo.save(locked);
            core_1.Logger.info(`Coupon ${code} redeemed for order ${orderId}, discount=${result.discountAmount}`, constants_1.loggerCtx);
            return saved;
        });
    }
    /** 释放：订单取消时归还券码。 */
    async releaseCoupon(ctx, code) {
        const repo = this.connection.getRepository(ctx, coupon_code_entity_1.CouponCode);
        const couponCode = await repo.findOne({ where: { code } });
        if (!couponCode)
            throw new core_1.EntityNotFoundError('CouponCode', code);
        if (couponCode.status !== constants_1.CouponCodeStatus.Used)
            return couponCode;
        couponCode.status = constants_1.CouponCodeStatus.Unused;
        couponCode.usedAt = undefined;
        couponCode.orderId = null;
        const saved = await repo.save(couponCode);
        core_1.Logger.info(`Coupon ${code} released`, constants_1.loggerCtx);
        return saved;
    }
    // ===== Promotion 桥接 =====
    /**
     * 将券码绑定到订单（设置 order.customFields.appliedCouponCode）。
     * 设置后立即调用 applyPriceAdjustments 触发价格重新计算，
     * 使 couponOrderAction 计算的折扣反映到 order.discounts 和 totalWithTax。
     * 不修改券码状态——状态变更由 OrderPlacedEvent 触发 redeemCoupon 完成。
     */
    async applyCouponToOrder(ctx, orderId, code) {
        const orderLines = await this.getOrderLinesForCoupon(ctx, orderId);
        const result = await this.validateCoupon(ctx, code, orderLines);
        if (!result.valid) {
            return result;
        }
        await this.orderService.updateCustomFields(ctx, orderId, { appliedCouponCode: code });
        // updateCustomFields 不触发价格重新计算，需手动调用 applyPriceAdjustments
        await this.recalculateOrder(ctx, orderId);
        return result;
    }
    /**
     * 移除订单上绑定的优惠券：清除 customFields.appliedCouponCode 并触发价格重新计算。
     */
    async removeCouponFromOrder(ctx, orderId) {
        await this.orderService.updateCustomFields(ctx, orderId, { appliedCouponCode: null });
        await this.recalculateOrder(ctx, orderId);
    }
    /** 触发订单价格重新计算（使 couponOrderAction 等 promotion 生效）。 */
    async recalculateOrder(ctx, orderId) {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
        ]);
        if (order) {
            await this.orderService.applyPriceAdjustments(ctx, order);
        }
    }
    /** 订单取消时清除绑定的券码并释放券码。 */
    async releaseCouponOnOrder(ctx, orderId) {
        var _a, _b;
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order)
            return;
        const code = (_a = order.customFields) === null || _a === void 0 ? void 0 : _a.appliedCouponCode;
        if (!code)
            return;
        try {
            await this.releaseCoupon(ctx, code);
            await this.orderService.updateCustomFields(ctx, orderId, { appliedCouponCode: null });
        }
        catch (e) {
            core_1.Logger.error(`Failed to release coupon ${code} for order ${orderId}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
        }
    }
    // ===== Scheduled: expire =====
    /** 过期所有 unused 且对应券已过 endAt 的券码。 */
    async expireCoupons(ctx) {
        var _a;
        const codeRepo = this.connection.getRepository(ctx, coupon_code_entity_1.CouponCode);
        const couponRepo = this.connection.getRepository(ctx, coupon_entity_1.Coupon);
        const now = new Date();
        const expiredCoupons = await couponRepo
            .createQueryBuilder('coupon')
            .select(['coupon.id'])
            .where('coupon.endAt < :now', { now })
            .getMany();
        if (expiredCoupons.length === 0)
            return 0;
        const expiredCouponIds = expiredCoupons.map(c => c.id);
        const result = await codeRepo
            .createQueryBuilder()
            .update(coupon_code_entity_1.CouponCode)
            .set({ status: constants_1.CouponCodeStatus.Expired })
            .where('status = :status', { status: constants_1.CouponCodeStatus.Unused })
            .andWhere('couponId IN (:...ids)', { ids: expiredCouponIds })
            .execute();
        const affected = (_a = result.affected) !== null && _a !== void 0 ? _a : 0;
        if (affected > 0) {
            core_1.Logger.info(`Expired ${affected} coupon codes`, constants_1.loggerCtx);
        }
        return affected;
    }
    // ===== Helpers =====
    /** 将订单行映射为券校验所需的简化结构。供 resolver 与 redeemCoupon 复用。 */
    async getOrderLinesForCoupon(ctx, orderId) {
        const order = await this.orderService.findOne(ctx, orderId, [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.collections',
        ]);
        if (!order)
            throw new core_1.EntityNotFoundError('Order', orderId);
        return this.mapOrderToLines(order);
    }
    mapOrderToLines(order) {
        var _a;
        return ((_a = order.lines) !== null && _a !== void 0 ? _a : []).map(line => {
            var _a, _b, _c, _d, _e, _f, _g;
            return ({
                productId: Number((_b = (_a = line.productVariant) === null || _a === void 0 ? void 0 : _a.productId) !== null && _b !== void 0 ? _b : 0),
                variantId: Number((_c = line.productVariantId) !== null && _c !== void 0 ? _c : 0),
                quantity: (_d = line.quantity) !== null && _d !== void 0 ? _d : 0,
                lineTotal: (_e = line.linePrice) !== null && _e !== void 0 ? _e : 0,
                collectionIds: ((_g = (_f = line.productVariant) === null || _f === void 0 ? void 0 : _f.collections) !== null && _g !== void 0 ? _g : []).map(c => Number(c.id)),
            });
        });
    }
    computeEligibleTotal(coupon, orderLines) {
        const productFilter = coupon.applicableProductIds && coupon.applicableProductIds.length > 0
            ? new Set(coupon.applicableProductIds)
            : null;
        const categoryFilter = coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0
            ? new Set(coupon.applicableCategoryIds)
            : null;
        return orderLines
            .filter(line => {
            if (productFilter && !productFilter.has(line.productId))
                return false;
            if (categoryFilter) {
                const hit = line.collectionIds.some(id => categoryFilter.has(id));
                if (!hit)
                    return false;
            }
            return true;
        })
            .reduce((sum, line) => sum + line.lineTotal, 0);
    }
    computeDiscount(coupon, eligibleTotal) {
        let discount = 0;
        if (coupon.couponType === 'fixed') {
            discount = coupon.discountValue;
        }
        else if (coupon.couponType === 'percentage') {
            discount = Math.floor((eligibleTotal * coupon.discountValue) / 100);
        }
        if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
        }
        if (discount > eligibleTotal) {
            discount = eligibleTotal;
        }
        return Math.max(0, discount);
    }
    generateCode() {
        return (0, crypto_1.randomBytes)(6).toString('hex').toUpperCase();
    }
    async isNewCustomer(ctx, customerId) {
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const count = await repo
            .createQueryBuilder('order')
            .leftJoin('order.customer', 'customer')
            .where('customer.id = :customerId', { customerId })
            .andWhere('order.state NOT IN (:...states)', { states: NON_PLACED_STATES })
            .getCount();
        return count === 0;
    }
};
exports.CouponService = CouponService;
exports.CouponService = CouponService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder,
        core_1.CustomerService,
        core_1.OrderService])
], CouponService);
//# sourceMappingURL=coupon.service.js.map