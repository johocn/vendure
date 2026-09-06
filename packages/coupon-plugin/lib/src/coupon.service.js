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
exports.CouponService = exports.CouponNotOwnedError = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const constants_1 = require("./constants");
const localize_1 = require("./localize");
const coupon_scope_1 = require("./coupon-scope");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/** 模板 update() 允许写入的字段白名单 */
const TEMPLATE_UPDATE_ALLOWED = [
    'name',
    'description',
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
/**
 * 属店权限不足错误。本版本 Vendure 的 ForbiddenError 构造器固定 message='error.forbidden'（code='FORBIDDEN'），
 * 无法注入自定义文案；故继承 I18nError，沿用 FORBIDDEN 错误码，以显式携带 COUPON_NOT_OWNED 语义消息。
 */
class CouponNotOwnedError extends core_1.I18nError {
    constructor() {
        super(constants_1.COUPON_NOT_OWNED, {}, 'FORBIDDEN', core_1.LogLevel.Warn);
    }
}
exports.CouponNotOwnedError = CouponNotOwnedError;
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
        const qb = this.listQueryBuilder.build(coupon_template_entity_1.CouponTemplate, options, {
            ctx,
            channelId: ctx.channelId,
            relations: ['channels'],
        });
        // 属店隔离：店主管理员只能看到「平台级券（shopId 为空）」+「本店发的券」；
        // 超级管理员（无属店）→ 全量。
        const adminShopId = await this.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
        if (adminShopId != null) {
            qb.andWhere('(coupontemplate.shopId IS NULL OR coupontemplate.shopId = :adminShopId)', {
                adminShopId,
            });
        }
        return qb
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }
    async findOneTemplate(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await repo.findOne({
            where: { id: id },
            relations: { channels: true },
        });
        if (tpl) {
            await this.assertManagedByShop(ctx, tpl.shopId);
        }
        return tpl !== null && tpl !== void 0 ? tpl : undefined;
    }
    async createTemplate(ctx, input) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = new coupon_template_entity_1.CouponTemplate(input);
        if (tpl.type === 'FULL') {
            tpl.minSpend = 0;
        }
        tpl.channels = [ctx.channel];
        tpl.claimedCount = 0;
        // 发行归属店铺（跨渠道范围用）：优先采用显式传入的 shopId，否则从当前管理员的店解析。
        // 若 Shop / Administrator 依赖插件未注册或无法解析，则保持 undefined（不阻断）。
        if (input.shopId != null) {
            tpl.shopId = Number(input.shopId);
        }
        else if (tpl.shopId == null) {
            const shopId = await this.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
            if (shopId != null) {
                tpl.shopId = Number(shopId);
            }
        }
        return repo.save(tpl);
    }
    async updateTemplate(ctx, input) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await repo.findOne({ where: { id: input.id } });
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate with id ${input.id} not found`);
        }
        await this.assertManagedByShop(ctx, tpl.shopId);
        for (const key of TEMPLATE_UPDATE_ALLOWED) {
            if (key in input) {
                tpl[key] = input[key];
            }
        }
        return repo.save(tpl);
    }
    async deleteTemplate(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await repo.findOne({ where: { id: id } });
        if (tpl) {
            await this.assertManagedByShop(ctx, tpl.shopId);
        }
        await repo.delete(id);
    }
    /* ------------------------- 领券中心 / 券包 ------------------------- */
    async couponCentre(ctx) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const now = new Date();
        const own = await repo
            .createQueryBuilder('tpl')
            .innerJoin('tpl.channels', 'channel', 'channel.id = :channelId', { channelId: ctx.channelId })
            .where('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .getMany();
        // 非默认商城维持现状：仅列出本渠道券。
        if (!(0, coupon_scope_1.isDefaultMallChannel)(ctx)) {
            return own;
        }
        // 默认商城：除本渠道券外，追加列出「其 shopId 对应商品出现在本商城」的租户券。
        const shopIds = await this.shopIdsPresentInChannel(ctx);
        if (shopIds.size === 0) {
            return own;
        }
        const extra = await repo
            .createQueryBuilder('tpl')
            .where('tpl.shopId IN (:...shopIds)', { shopIds: [...shopIds] })
            .andWhere('tpl.enabled = :enabled', { enabled: true })
            .andWhere('(tpl.startsAt IS NULL OR tpl.startsAt <= :now)', { now })
            .andWhere('(tpl.endsAt IS NULL OR tpl.endsAt >= :now)', { now })
            .getMany();
        const ownIds = new Set(own.map(t => String(t.id)));
        return [...own, ...extra.filter(t => !ownIds.has(String(t.id)))];
    }
    /** 默认商城渠道下，本商城商品（Product.customFields.shopId）中出现过的店铺 id 集合。 */
    async shopIdsPresentInChannel(ctx) {
        var _a, _b;
        const set = new Set();
        try {
            const productRepo = this.connection.getRepository(ctx, core_1.Product);
            const products = await productRepo.find({ relations: { channels: true } });
            for (const p of products) {
                const inChannel = ((_a = p.channels) !== null && _a !== void 0 ? _a : []).some((c) => String(c.id) === String(ctx.channelId));
                if (!inChannel)
                    continue;
                const sid = Number(((_b = p.customFields) !== null && _b !== void 0 ? _b : {}).shopId);
                if (sid && !Number.isNaN(sid))
                    set.add(sid);
            }
        }
        catch (_c) {
            // Product 不可用等场景忽略，仅返回本渠道券
        }
        return set;
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
        await this.memberLevelService.spendPoints(ctx, customerId, tpl.pointsPrice, null, `积分兑换优惠券:${(0, localize_1.localizeText)(tpl.name, ctx.languageCode, '')}`);
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
    /* ------------------------- 定向发券（批量 + 通知） ------------------------- */
    async listChannelCustomers(ctx, query, take = 20, skip = 0) {
        const repo = this.connection.getRepository(ctx, core_1.Customer);
        const qb = repo
            .createQueryBuilder('c')
            .select([
            'c.id',
            'c.emailAddress',
            'c.firstName',
            'c.lastName',
            'c.phoneNumber',
            'c.createdAt',
        ])
            .innerJoin('c.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId });
        if (query) {
            const q = `%${query.trim().toLowerCase()}%`;
            qb.andWhere('(LOWER(c.emailAddress) LIKE :q OR LOWER(c.firstName) LIKE :q OR LOWER(c.lastName) LIKE :q OR LOWER(c.phoneNumber) LIKE :q)', { q });
        }
        qb.orderBy('c.id', 'DESC').skip(skip).take(take);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async customerInChannel(ctx, customerId) {
        const repo = this.connection.getRepository(ctx, core_1.Customer);
        const count = await repo
            .createQueryBuilder('c')
            .innerJoin('c.channels', 'channel', 'channel.id = :cid', { cid: ctx.channelId })
            .where('c.id = :id', { id: customerId })
            .getCount();
        return count > 0;
    }
    async notifyCouponIssued(ctx, customerId, tpl, code) {
        // 复用 message-plugin 的 Message/MessageDelivery（invoice-plugin 已落地范式）；
        // 未装 message-plugin 时实体不存在，抛错由调用方捕获、不阻塞发券。
        const msgRepo = this.connection.getRepository(ctx, 'Message');
        const delRepo = this.connection.getRepository(ctx, 'MessageDelivery');
        const name = (0, localize_1.localizeText)(tpl.name, ctx.languageCode, '优惠券');
        const title = `优惠券到账：${name}`;
        const body = `您获得本店定向赠送优惠券，券码 ${code}，可在结算时抵扣。`;
        const message = await msgRepo.save(msgRepo.create({
            title,
            body,
            deliveryChannel: 'inapp',
            audienceType: 'all',
            status: 'sent',
            totalTarget: 1,
            totalSent: 1,
            channels: [ctx.channel],
        }));
        await delRepo.save(delRepo.create({
            messageId: message.id,
            customerId: Number(customerId),
            deliveryStatus: 'sent',
            channels: [ctx.channel],
        }));
    }
    async grantCouponIssue(ctx, templateId, customerIds, notify) {
        var _a;
        const tpl = await this.findOneTemplate(ctx, templateId);
        if (!tpl) {
            throw new core_1.UserInputError(`CouponTemplate ${templateId} not found`);
        }
        const customerRepo = this.connection.getRepository(ctx, core_1.Customer);
        const results = [];
        for (const customerId of customerIds) {
            try {
                const cust = await customerRepo.findOne({
                    where: { id: customerId },
                    relations: { user: true },
                });
                if (!cust) {
                    results.push({ customerId, ok: false, code: null, reason: 'CUSTOMER_NOT_FOUND' });
                    continue;
                }
                if (!(await this.customerInChannel(ctx, customerId))) {
                    results.push({ customerId, ok: false, code: null, reason: 'CUSTOMER_NOT_IN_CHANNEL' });
                    continue;
                }
                if (tpl.perUserLimit > 0) {
                    const owned = await this.countHeld(Number(customerId), tpl.id);
                    if (owned >= tpl.perUserLimit) {
                        results.push({ customerId, ok: false, code: null, reason: 'PER_USER_LIMIT' });
                        continue;
                    }
                }
                const ok = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
                if (!ok) {
                    results.push({ customerId, ok: false, code: null, reason: 'SOLD_OUT' });
                    continue;
                }
                const cc = await this.createUserCoupon(ctx, Number(customerId), tpl, 'ADMIN');
                results.push({ customerId, ok: true, code: cc.code, reason: null });
                if (notify) {
                    try {
                        await this.notifyCouponIssued(ctx, customerId, tpl, cc.code);
                    }
                    catch (e) {
                        core_1.Logger.warn(`notifyCouponIssued failed for ${customerId}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
                    }
                }
            }
            catch (e) {
                results.push({ customerId, ok: false, code: null, reason: 'ERROR' });
            }
        }
        return results;
    }
    async revokeCoupon(ctx, id) {
        var _a;
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const cc = await repo.findOne({ where: { id: id }, relations: { template: true } });
        if (!cc) {
            throw new core_1.UserInputError(`CustomerCoupon ${id} not found`);
        }
        // 属店隔离：revoke 针对券实例，按其所关联券模板的发行店校验归属。
        await this.assertManagedByShop(ctx, (_a = cc.template) === null || _a === void 0 ? void 0 : _a.shopId);
        if (cc.status === 'UNUSED') {
            cc.status = 'INVALID';
            await repo.save(cc);
        }
        return cc;
    }
    /* ------------------------- 结算选券 / 清券 ------------------------- */
    async applyCouponToOrder(ctx, orderId, code) {
        var _a, _b, _c, _d, _e;
        const order = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'customer.user',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
        ]);
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
        // 跨渠道范围校验 + 本店商品行基数（默认商城：仅本店行参与门槛/折扣；非默认商城整单）。
        const tplShopId = tpl.shopId;
        const lines = ((_d = order === null || order === void 0 ? void 0 : order.lines) !== null && _d !== void 0 ? _d : []);
        const eligibleLines = (0, coupon_scope_1.isDefaultMallChannel)(ctx)
            ? lines.filter(l => (0, coupon_scope_1.lineHasShopId)(l, tplShopId))
            : lines;
        if ((0, coupon_scope_1.isDefaultMallChannel)(ctx) && eligibleLines.length === 0) {
            throw new core_1.UserInputError('COUPON_SCOPE_MISMATCH');
        }
        const base = (ctx.channel.pricesIncludeTax
            ? eligibleLines.reduce((s, l) => { var _a; return s + ((_a = l.linePriceWithTax) !== null && _a !== void 0 ? _a : 0); }, 0)
            : eligibleLines.reduce((s, l) => { var _a; return s + ((_a = l.linePrice) !== null && _a !== void 0 ? _a : 0); }, 0));
        if (tpl.minSpend > base) {
            throw new core_1.UserInputError(`Order total below minimum spend of ${tpl.minSpend} for this coupon`);
        }
        // 一单一券：先清旧再覆写，随后重算 promotions
        const updatedOrder = await this.orderService.updateCustomFields(ctx, orderId, {
            couponCode: cc.code,
            couponId: cc.id,
        });
        // 确保传给 promotions 重算的订单在其 OrderLine 上带 productVariant.product，
        // 以便 coupon_applied 条件读取 Product.customFields.shopId 做行级范围判定。
        for (const line of (_e = updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder.lines) !== null && _e !== void 0 ? _e : []) {
            const matched = (lines !== null && lines !== void 0 ? lines : []).find(l => String(l.id) === String(line.id));
            if (matched && (line.productVariant == null || !line.productVariant.product)) {
                line.productVariant = matched.productVariant;
            }
        }
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
    /**
     * 归属解析：activeUserId → Administrator.user → Shop.administratorId（与 shop-plugin 同法，不依赖 ctx.channelId）。
     * 若连接未注册 Shop 实体（shop-plugin 未加载）或 admin 无法解析，则回退为 undefined（不阻断）。
     *
     * 公开（public）：供 CouponAdminResolver 等鉴权调用点复用，避免在 service 内重复实现。
     * 保持签名兼容，Task B 既有的私有调用不受影响。
     */
    async resolveShopIdFromActiveUser(ctx, userId) {
        try {
            if (userId == null)
                return undefined;
            const adminRepo = this.connection.getRepository(ctx, core_1.Administrator);
            const admin = await adminRepo.findOne({
                where: { user: { id: userId } },
                select: { id: true },
            });
            if (!admin || admin.id == null)
                return undefined;
            const ShopClass = this.findEntityClass('Shop');
            if (!ShopClass)
                return undefined;
            const shopRepo = this.connection.getRepository(ctx, ShopClass);
            const shop = await shopRepo.findOne({ where: { administratorId: admin.id } });
            return shop === null || shop === void 0 ? void 0 : shop.id;
        }
        catch (_a) {
            // Shop / Administrator 等可选依赖未注册或查询失败 → 保持未设 shopId
            return undefined;
        }
    }
    /**
     * 原则：超级管理员（无属店 Shop）可管理全部券；属店管理员只能管理「平台级券（shopId 为空）
     * + 本店发行的券」，其余一率抛 ForbiddenError(COUPON_NOT_OWNED)。
     * 供 resolver 与列表过滤复用。
     */
    async assertManagedByShop(ctx, targetShopId) {
        const adminShopId = await this.resolveShopIdFromActiveUser(ctx, ctx.activeUserId);
        // 当前管理员无属店（超级管理员）→ 全量允许
        if (adminShopId == null)
            return;
        const target = targetShopId != null ? Number(targetShopId) : undefined;
        // 目标券无属店（平台级券）→ 允许本地化运营管理；本店券 → 允许；他店券 → 拒绝。
        if (target != null && target !== adminShopId) {
            throw new CouponNotOwnedError();
        }
    }
    /** 按实体名称从连接元数据中取回实体类（用于在插件未直接依赖 Shop 时安全解析）。 */
    findEntityClass(name) {
        try {
            const meta = this.connection.rawConnection.entityMetadatas.find(m => m.name === name);
            return meta ? meta.target : undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
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