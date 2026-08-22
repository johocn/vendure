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
const core_1 = require("@vendure/core");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const constants_1 = require("./constants");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/** 模板 update() 允许写入的字段白名单 */
const TEMPLATE_UPDATE_ALLOWED = [
    'name',
    'type',
    'discountValue',
    'minSpend',
    'startsAt',
    'endsAt',
    'totalCount',
    'pointsPrice',
    'perUserLimit',
    'scope',
    'categoryId',
    'variantId',
    'enabled',
];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(prefix) {
    const seg = (n) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    return `${prefix}-${seg(4)}-${seg(4)}`;
}
let CouponService = class CouponService {
    constructor(connection, listQueryBuilder) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.codePrefix = 'C';
    }
    init(injector) {
        this.orderService = injector.get(core_1.OrderService);
        this.customerService = injector.get(core_1.CustomerService);
        try {
            this.memberLevelService = injector.get(member_level_plugin_1.MemberLevelService);
        }
        catch (_a) {
            // member-level-plugin 未注册则禁用积分兑换
            this.memberLevelService = null;
        }
        try {
            const opts = injector.get('COUPON_PLUGIN_OPTIONS');
            if (opts === null || opts === void 0 ? void 0 : opts.codePrefix) {
                this.codePrefix = opts.codePrefix;
            }
        }
        catch (_b) {
            // options not injected
        }
    }
    /* ------------------------- 模板管理 ------------------------- */
    async findAllTemplates(ctx, options) {
        return this.listQueryBuilder
            .build(coupon_template_entity_1.CouponTemplate, options, { ctx, channelId: ctx.channelId, relations: ['channels'] })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findOneTemplate(ctx, id) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        return ((_a = (await repo.findOne({
            where: { id: id },
            relations: { channels: true },
        }))) !== null && _a !== void 0 ? _a : undefined);
    }
    async createTemplate(ctx, input) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = new coupon_template_entity_1.CouponTemplate(input);
        if (tpl.type === 'FULL') {
            tpl.minSpend = 0;
        }
        tpl.channels = [ctx.channel];
        tpl.claimedCount = 0;
        return repo.save(tpl);
    }
    async updateTemplate(ctx, input) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await repo.findOne({ where: { id: input.id } });
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate with id ${input.id} not found`);
        }
        for (const key of TEMPLATE_UPDATE_ALLOWED) {
            if (key in input) {
                tpl[key] = input[key];
            }
        }
        return repo.save(tpl);
    }
    async deleteTemplate(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        await repo.delete(id);
    }
    /* ------------------------- 领券中心 / 券包 ------------------------- */
    async couponCentre(ctx) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const now = new Date();
        return repo
            .createQueryBuilder('tpl')
            .innerJoin('tpl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .getMany();
    }
    async listMyCoupons(ctx, status) {
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId)
            return [];
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const qb = repo
            .createQueryBuilder('cc')
            .leftJoinAndSelect('cc.template', 'template')
            .where('cc.customerId = :customerId', { customerId });
        if (status) {
            qb.andWhere('cc.status = :status', { status });
        }
        return qb.getMany();
    }
    async listAllCoupons(ctx, options) {
        return this.listQueryBuilder
            .build(customer_coupon_entity_1.CustomerCoupon, options, {
            ctx,
            relations: ['template'],
        })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    /* ------------------------- 积分兑换商城 ------------------------- */
    async pointsMallTemplates(ctx) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const now = new Date();
        return repo
            .createQueryBuilder('tpl')
            .innerJoin('tpl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('tpl.enabled = :enabled', { enabled: true })
            .andWhere('tpl.pointsPrice > 0')
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .orderBy('tpl.pointsPrice', 'ASC')
            .getMany();
    }
    async exchangeWithPoints(ctx, templateId) {
        if (!this.memberLevelService) {
            throw new core_1.UserInputError('Points service is not enabled');
        }
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            throw new core_1.UserInputError('No customer for the current user');
        }
        const tpl = await this.findOneTemplate(ctx, templateId);
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
        }
        if (tpl.pointsPrice <= 0) {
            throw new core_1.UserInputError('This coupon is not exchangeable with points');
        }
        const now = new Date();
        if (!tpl.enabled) {
            throw new core_1.UserInputError('Coupon template is disabled');
        }
        if (tpl.startsAt && now < tpl.startsAt) {
            throw new core_1.UserInputError('Not yet started');
        }
        if (tpl.endsAt && now > tpl.endsAt) {
            throw new core_1.UserInputError('Coupon redeemed');
        }
        // 限兑校验
        if (tpl.perUserLimit > 0) {
            const owned = await this.countHeld(customerId, tpl.id);
            if (owned >= tpl.perUserLimit) {
                throw new core_1.UserInputError('Per-user redemption limit reached');
            }
        }
        // 扣积分（原子 + SPEND 流水；不足抛 Insufficient；Transaction 保证与发券同回滚）
        await this.memberLevelService.spendPoints(ctx, customerId, tpl.pointsPrice, null, `积分兑换优惠券:${tpl.name}`);
        // 原子扣发行余量（防超发）
        const ok = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
        if (!ok) {
            throw new core_1.UserInputError('Coupon sold out');
        }
        const coupon = await this.createUserCoupon(ctx, customerId, tpl, 'EXCHANGE');
        return { coupon, spentPoints: tpl.pointsPrice };
    }
    /* ------------------------- 领券 / 定向发券 ------------------------- */
    async claimCoupon(ctx, templateId) {
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            throw new core_1.UserInputError('No customer for the current user');
        }
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await repo.findOne({
            where: { id: templateId },
            relations: { channels: true },
        });
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const now = new Date();
        if (!tpl.enabled) {
            throw new core_1.UserInputError('Coupon template is disabled');
        }
        if (tpl.startsAt && now < tpl.startsAt) {
            throw new core_1.UserInputError('Coupon not yet started');
        }
        if (tpl.endsAt && now > tpl.endsAt) {
            throw new core_1.UserInputError('Coupon has expired');
        }
        // 限领校验
        if (tpl.perUserLimit > 0) {
            const owned = await this.countHeld(customerId, tpl.id);
            if (owned >= tpl.perUserLimit) {
                throw new core_1.UserInputError('Per-user coupon limit reached');
            }
        }
        // 原子扣减发行余量（防超发）
        const claim = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
        if (!claim) {
            throw new core_1.UserInputError('Coupon sold out');
        }
        return this.createUserCoupon(ctx, customerId, tpl, 'CENTRE');
    }
    async grantCoupon(ctx, templateId, customerIds) {
        const tpl = await this.findOneTemplate(ctx, templateId);
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const codes = [];
        for (const customerId of customerIds) {
            const ok = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
            if (!ok) {
                throw new core_1.UserInputError('Coupon sold out');
            }
            const cc = await this.createUserCoupon(ctx, customerId, tpl, 'ADMIN');
            codes.push(cc.code);
        }
        return codes;
    }
    async revokeCoupon(ctx, id) {
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const cc = await repo.findOne({ where: { id: id } });
        if (!cc) {
            throw new core_1.UserInputError(`CustomerCoupon ${id} not found`);
        }
        if (cc.status === 'UNUSED') {
            cc.status = 'INVALID';
            await repo.save(cc);
        }
        return cc;
    }
    /* ------------------------- 结算选券 / 清券 ------------------------- */
    async applyCouponToOrder(ctx, orderId, code) {
        var _a, _b, _c;
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new core_1.UserInputError(`Order ${orderId} not found`);
        }
        // 归属校验：order.customer.user.id === ctx.activeUserId（勿用 customer.id）
        if (((_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) !== ctx.activeUserId) {
            throw new core_1.UserInputError('You can only apply coupons to your own order');
        }
        const customerId = (_c = order === null || order === void 0 ? void 0 : order.customer) === null || _c === void 0 ? void 0 : _c.id;
        if (!customerId) {
            throw new core_1.UserInputError('Order has no customer');
        }
        const ccRepo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const cc = await ccRepo.findOne({
            where: { code },
            relations: { template: true },
        });
        if (!cc || cc.customerId !== customerId) {
            throw new core_1.UserInputError('Coupon not found or does not belong to you');
        }
        // UNUSED / RETURNED（取消回退后可复用）可被选定
        if (cc.status !== 'UNUSED' && cc.status !== 'RETURNED') {
            throw new core_1.UserInputError('Coupon is not in a usable state');
        }
        const tpl = cc.template;
        if (!tpl) {
            throw new core_1.UserInputError('Coupon template not found');
        }
        const now = new Date();
        if (!tpl.enabled) {
            throw new core_1.UserInputError('Coupon template is disabled');
        }
        if (tpl.startsAt && now < tpl.startsAt) {
            throw new core_1.UserInputError('Coupon not yet active');
        }
        if (tpl.endsAt && now > tpl.endsAt) {
            throw new core_1.UserInputError('Coupon has expired');
        }
        const base = ctx.channel.pricesIncludeTax ? order.subTotalWithTax : order.subTotal;
        if (tpl.minSpend > base) {
            throw new core_1.UserInputError(`Order total below minimum spend of ${tpl.minSpend} for this coupon`);
        }
        // 一单一券：先清旧再覆写，随后重算 promotions
        const updatedOrder = await this.orderService.updateCustomFields(ctx, orderId, {
            couponCode: cc.code,
            couponId: cc.id,
        });
        return this.orderService.applyPriceAdjustments(ctx, updatedOrder);
    }
    async clearCouponFromOrder(ctx, orderId) {
        var _a, _b;
        const order = await this.orderService.findOne(ctx, orderId, ['customer', 'customer.user']);
        if (!order) {
            throw new core_1.UserInputError(`Order ${orderId} not found`);
        }
        if (((_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) !== ctx.activeUserId) {
            throw new core_1.UserInputError('You can only clear coupons on your own order');
        }
        const updatedOrder = await this.orderService.updateCustomFields(ctx, orderId, {
            couponCode: null,
            couponId: null,
        });
        return this.orderService.applyPriceAdjustments(ctx, updatedOrder);
    }
    /* ------------------------- 销核 / 回退（事件触发） ------------------------- */
    /** 支付成功后核销券 */
    async bindAsUsed(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const code = await this.orderCode(ctx, orderId);
        if (!code)
            return;
        const cc = await repo.findOne({ where: { code } });
        if (!cc || cc.status !== 'UNUSED')
            return;
        cc.status = 'USED';
        cc.usedOrderId = orderId;
        cc.usedAt = new Date();
        await repo.save(cc);
        core_1.Logger.info(`Coupon ${code} marked as USED on order ${orderId}`, constants_1.loggerCtx);
    }
    /** 订单取消回退券（可复用） */
    async returnCoupon(ctx, orderId) {
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const code = await this.orderCode(ctx, orderId);
        if (!code)
            return;
        const cc = await repo.findOne({ where: { code } });
        if (!cc || cc.status !== 'USED')
            return;
        if (String(cc.usedOrderId) !== String(orderId))
            return; // 幂等
        cc.status = 'RETURNED';
        // TypeORM 对 undefined 不作为变更持久化，清理可空列必须显式置 null
        cc.usedOrderId = null;
        cc.usedAt = null;
        await repo.save(cc);
        core_1.Logger.info(`Coupon ${code} returned on order ${orderId} cancellation`, constants_1.loggerCtx);
    }
    /* ------------------------- 私有工具 ------------------------- */
    async orderCode(_ctx, orderId) {
        var _a, _b;
        // 用户券销核/回退时，从订单 customFields 读券码
        const order = await this.orderService.findOne(_ctx, orderId);
        return (_b = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.couponCode) !== null && _b !== void 0 ? _b : undefined;
    }
    async currentCustomerId(ctx) {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return customer === null || customer === void 0 ? void 0 : customer.id;
    }
    async countHeld(customerId, templateId) {
        // 未跑在具体 ctx 内，用原始连接
        const countRepo = this.connection.rawConnection.getRepository(customer_coupon_entity_1.CustomerCoupon);
        return countRepo
            .createQueryBuilder('cc')
            .where('cc.customerId = :customerId', { customerId })
            .andWhere('cc.templateId = :templateId', { templateId: templateId })
            .andWhere("cc.status NOT IN ('RETURNED','INVALID','EXPIRED')")
            .getCount();
    }
    /** 原子扣减发行余量；受影响数大于 0 表示成功 */
    async atomicIncrementClaimed(ctx, templateId, tpl) {
        var _a;
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ claimedCount: () => 'claimedCount + 1' })
            .where('id = :id AND (totalCount = 0 OR claimedCount < totalCount)', { id: templateId })
            .execute();
        return ((_a = result.affected) !== null && _a !== void 0 ? _a : 0) > 0;
    }
    async createUserCoupon(ctx, customerId, tpl, issuedBy) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        // 重试兜底唯一码冲突（碰撞概率极低）
        for (let attempt = 0; attempt < 3; attempt++) {
            const code = generateCode(this.codePrefix);
            const cc = new customer_coupon_entity_1.CustomerCoupon({
                customerId,
                templateId: tpl.id,
                code,
                status: 'UNUSED',
                issuedBy,
                issuedAt: new Date(),
                expiredAt: (_a = tpl.endsAt) !== null && _a !== void 0 ? _a : undefined,
            });
            try {
                return await repo.save(cc);
            }
            catch (e) {
                if (String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : '').includes('unique'))
                    continue;
                throw e;
            }
        }
        throw new core_1.UserInputError('Failed to generate a unique coupon code');
    }
};
exports.CouponService = CouponService;
exports.CouponService = CouponService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ListQueryBuilder])
], CouponService);
//# sourceMappingURL=coupon.service.js.map