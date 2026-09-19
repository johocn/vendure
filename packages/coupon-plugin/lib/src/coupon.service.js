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
const coupon_binding_service_1 = require("./coupon-binding.service");
const coupon_settlement_1 = require("./coupon-settlement");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const product_coupon_binding_entity_1 = require("./product-coupon-binding.entity");
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
    constructor(connection, listQueryBuilder, bindingService) {
        this.connection = connection;
        this.listQueryBuilder = listQueryBuilder;
        this.bindingService = bindingService;
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
    /* ------------------------- 会员等级限制（P2） ------------------------- */
    /**
     * 将模板上的 memberLevel 字符串解析为所需最低档位（1-5）。
     * 支持：纯数字（"3"→3）、英文档位码（gold→3）、中文档位名（金卡会员→3）。
     * 无法解析或空 → 返回 null（不设限，fail-open）。对未知文案保持宽容，避免误伤。
     */
    async resolveRequiredMemberLevel(memberLevel) {
        if (memberLevel == null)
            return null;
        const s = String(memberLevel).trim();
        if (!s)
            return null;
        if (/^\d+$/.test(s)) {
            const n = parseInt(s, 10);
            return n >= 1 && n <= 5 ? n : null;
        }
        const tierAliases = [
            { level: 1, keys: ['普通', '普通会员', 'bronze', 'bronze member'] },
            { level: 2, keys: ['银', '银卡', '银卡会员', 'silver', 'silver member'] },
            { level: 3, keys: ['金', '金卡', '金卡会员', 'gold', 'gold member'] },
            { level: 4, keys: ['白金', '白金会员', 'platinum', 'platinum member'] },
            { level: 5, keys: ['钻石', '钻石会员', 'diamond', 'diamond member'] },
        ];
        const lower = s.toLowerCase();
        for (const tier of tierAliases) {
            if (tier.keys.some(k => lower === k || lower.includes(k)))
                return tier.level;
        }
        return null;
    }
    /**
     * 会员等级门槛判定（非阻塞）。memberLevel 未设 / 解析失败 / 会员插件未注册 → 放行；
     * 否则要求顾客当前档位 >= 所需档位。
     */
    async couponMeetsMemberLevel(ctx, customerId, tpl) {
        var _a;
        const required = await this.resolveRequiredMemberLevel(tpl.memberLevel);
        if (required == null)
            return true;
        if (!this.memberLevelService)
            return true; // 会员插件未注册，fail-open
        const tier = await this.memberLevelService.resolveTierForCustomer(ctx, customerId);
        const level = (_a = tier === null || tier === void 0 ? void 0 : tier.tierLevel) !== null && _a !== void 0 ? _a : 1;
        return level >= required;
    }
    /** 会员等级门槛校验（抛错）。 */
    async assertCouponMemberLevel(ctx, customerId, tpl) {
        if (!(await this.couponMeetsMemberLevel(ctx, customerId, tpl))) {
            throw new core_1.UserInputError('Coupon requires a higher member level');
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
    /** 下线 CATEGORY scope（coupon.md §8 A1）：结算无分类匹配逻辑、无 UI/实体关系指向，
     *  使管理员误配「分类券」时静默全场可抵。create/update 一律拒绝该值。 */
    assertScopeSupported(scope) {
        if (scope === 'CATEGORY') {
            throw new core_1.UserInputError('Scope CATEGORY is not supported; use ALL or product binding (SKU) instead');
        }
    }
    async createTemplate(ctx, input) {
        this.assertScopeSupported(input === null || input === void 0 ? void 0 : input.scope);
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = new coupon_template_entity_1.CouponTemplate(input);
        if (tpl.type === 'FULL') {
            tpl.minSpend = 0;
        }
        tpl.channels = [ctx.channel];
        tpl.claimedCount = 0;
        // 多语言入参（P5）：nameZh/nameEn/descZh/descEn 合并为 LocalizedText 对象。
        this.applyMultilingualInput(tpl, input);
        if (tpl.name == null) {
            throw new core_1.UserInputError('CouponTemplate name (or nameZh) is required');
        }
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
        if (input.scope != null)
            this.assertScopeSupported(input.scope);
        for (const key of TEMPLATE_UPDATE_ALLOWED) {
            if (key in input) {
                tpl[key] = input[key];
            }
        }
        // 多语言入参（P5）：合并 nameZh/nameEn/descZh/descEn（保留既有其它语言文案）。
        this.applyMultilingualInput(tpl, input);
        return repo.save(tpl);
    }
    /**
     * 多语言合并：nameZh/nameEn/descZh/descEn 按需写入，产出 LocalizedText 对象，
     * 并保留既有的其它语言文案。任一多语言字段均未提供时不改动。
     */
    applyMultilingualInput(tpl, input) {
        var _a, _b, _c, _d, _e;
        const hasName = input.nameZh != null || input.nameEn != null;
        const hasDesc = input.descZh != null || input.descEn != null;
        if (hasName) {
            tpl.name = this.mergeLocalized(tpl.name, (_a = input.nameZh) !== null && _a !== void 0 ? _a : null, (_b = input.nameEn) !== null && _b !== void 0 ? _b : null);
        }
        if (hasDesc) {
            tpl.description = this.mergeLocalized((_c = tpl.description) !== null && _c !== void 0 ? _c : null, (_d = input.descZh) !== null && _d !== void 0 ? _d : null, (_e = input.descEn) !== null && _e !== void 0 ? _e : null);
        }
    }
    /** 合并单条 LocalizedText：当前值（对象取其已有键，纯字符串视为 zh）叠加 zh_Hans/en 覆盖。 */
    mergeLocalized(current, zh, en) {
        const obj = {};
        if (typeof current === 'object' && current != null) {
            Object.assign(obj, current);
        }
        else if (typeof current === 'string' && current) {
            obj.zh_Hans = current;
        }
        if (zh != null)
            obj.zh_Hans = zh;
        if (en != null)
            obj.en = en;
        return obj;
    }
    async deleteTemplate(ctx, id) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const tpl = await repo.findOne({ where: { id: id } });
        if (tpl) {
            await this.assertManagedByShop(ctx, tpl.shopId);
        }
        // 模板删除保护：已被商品绑定（ProductCouponBinding）引用时禁止删除，须先解绑
        const bindingCount = await this.connection
            .getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding)
            .count({ where: { couponTemplateId: id } });
        if (bindingCount > 0) {
            throw new core_1.UserInputError('Template has product bindings, unbind them first');
        }
        // A2：已发放券（customer_coupon 引用）保护——存在则抛可读错误，避免底层裸外键报错
        const issued = await this.connection
            .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
            .createQueryBuilder('cc')
            .where('cc.template = :id', { id: String(id) })
            .getCount();
        if (issued > 0) {
            throw new core_1.UserInputError(`Template has ${issued} issued coupon(s); revoke or delete the customer coupons first`);
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
            .andWhere('tpl.claimable = :claimable', { claimable: true })
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
            .andWhere('tpl.claimable = :claimable', { claimable: true })
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
        // 先收敛过期券：把本用户已越界的 UNUSED/RETURNED 落为 EXPIRED，其后 status 过滤即命中
        await this.expireDueCoupons(ctx, customerId);
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
        // 兑换前收敛过期券（与限兑/计数语义一致）
        await this.expireDueCoupons(ctx, customerId);
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
        // 领券前收敛过期券（与限领/计数语义一致：过期券不计持有）
        await this.expireDueCoupons(ctx, customerId);
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
        // 仅限新客：本租户历史有效订单数 > 0 则不可领
        if (tpl.newCustomerOnly) {
            const placed = await this.hasPlacedOrder(ctx, customerId);
            if (placed)
                throw new core_1.UserInputError('Coupon is for new customers only');
        }
        // 会员等级门槛（P2）
        await this.assertCouponMemberLevel(ctx, customerId, tpl);
        // 原子扣减发行余量（防超发）
        const claim = await this.atomicIncrementClaimed(ctx, tpl.id, tpl);
        if (!claim) {
            throw new core_1.UserInputError('Coupon sold out');
        }
        return this.createUserCoupon(ctx, customerId, tpl, 'CENTRE');
    }
    /* ------------------------- 商品详情页领券 / 凭码兑换（租户指定商品优惠券） ------------------------- */
    /** 详情页可领券：binding.enabled && 模板 enabled && claimable + 渠道匹配（listByProduct 已过滤） */
    async listProductCoupons(ctx, productId) {
        return this.bindingService.listByProduct(ctx, Number(productId));
    }
    /** 详情页领券：按 bindingId 找到模板后复用 claimCoupon（限领/余量/newCustomerOnly 校验都在其中） */
    async claimProductCoupon(ctx, bindingId) {
        var _a;
        const binding = await this.connection
            .getRepository(ctx, product_coupon_binding_entity_1.ProductCouponBinding)
            .findOne({ where: { id: bindingId }, relations: { template: true } });
        if (!binding || !binding.enabled) {
            throw new core_1.UserInputError('Binding not found');
        }
        if (binding.channelId != null && Number(binding.channelId) !== Number((_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new core_1.UserInputError('Binding not found');
        }
        if (!binding.template || !binding.template.claimable) {
            throw new core_1.UserInputError('Coupon is not claimable');
        }
        return this.claimCoupon(ctx, binding.couponTemplateId);
    }
    /** 凭码兑换：同租户内 claimCode 唯一匹配模板 → 复用 claimCoupon */
    async redeemByClaimCode(ctx, claimCode) {
        const repo = this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate);
        const candidates = await repo.find({
            where: { claimCode },
            relations: { channels: true },
        });
        const hit = candidates.find(t => t.claimCode && this.templateBelongsToChannel(ctx, t));
        if (!hit) {
            if (candidates.length === 0) {
                throw new core_1.UserInputError('Invalid claim code');
            }
            throw new core_1.UserInputError('Claim code not available in this shop');
        }
        return this.claimCoupon(ctx, hit.id);
    }
    /** 模板渠道归属校验：channels 为空（不限渠道）→ true；否则要求包含当前渠道 */
    templateBelongsToChannel(ctx, tpl) {
        if (!tpl.channels || tpl.channels.length === 0) {
            return true;
        }
        return tpl.channels.some(c => String(c.id) === String(ctx.channelId));
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
                // 会员等级门槛（P2）：不满足则本单不发券，单结果标记拦截，不抛错中断整批
                if (!(await this.couponMeetsMemberLevel(ctx, Number(customerId), tpl))) {
                    results.push({ customerId, ok: false, code: null, reason: 'MEMBER_LEVEL_BLOCKED' });
                    continue;
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
    /* ------------------------- 过期落库（EXPIRED） ------------------------- */
    /**
     * 惰性 EXPIRED 落库：把已越界（expiredAt <= now）但仍为 UNUSED/RETURNED 的券置为 EXPIRED。
     * 单语句条件 UPDATE，原子且幂等：条件含 `status IN ('UNUSED','RETURNED')` → 天然不会覆盖
     * USED/INVALID；已 EXPIRED 不在条件内 → 多次执行不受影响。返回受影响行数（便于观测/测试）。
     * customerId 省略时全量（供定时清扫），否则仅转化该用户（用户路径）。
     */
    async expireDueCoupons(ctx, customerId) {
        var _a;
        const repo = this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon);
        const qb = repo
            .createQueryBuilder()
            .update()
            .set({ status: 'EXPIRED' })
            .where("status IN ('UNUSED','RETURNED')")
            .andWhere('expiredAt IS NOT NULL')
            .andWhere('expiredAt <= :now', { now: new Date() });
        if (customerId != null) {
            qb.andWhere('customerId = :customerId', { customerId });
        }
        const result = await qb.execute();
        return (_a = result.affected) !== null && _a !== void 0 ? _a : 0;
    }
    /** 全量清扫（定时任务用）：rawConnection + 无 ctx，Replica 直连；幂等。 */
    async expireDueCouponsAll() {
        var _a;
        const repo = this.connection.rawConnection.getRepository(customer_coupon_entity_1.CustomerCoupon);
        const result = await repo
            .createQueryBuilder()
            .update()
            .set({ status: 'EXPIRED' })
            .where("status IN ('UNUSED','RETURNED')")
            .andWhere('expiredAt IS NOT NULL')
            .andWhere('expiredAt <= :now', { now: new Date() })
            .execute();
        return (_a = result.affected) !== null && _a !== void 0 ? _a : 0;
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
        // 实例级过期：过期（expiredAt）先落库 EXPIRED 再拒绝。
        // 注意：模板 endsAt 可能晚于实例 expiredAt（validDays 券），故须单独校验实例快照。
        const nowCc = new Date();
        if (cc.expiredAt && nowCc > cc.expiredAt) {
            if (cc.status === 'UNUSED' || cc.status === 'RETURNED') {
                cc.status = 'EXPIRED';
                await ccRepo.save(cc);
            }
            throw new core_1.UserInputError('Coupon has expired');
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
        // 会员等级门槛（P2）
        await this.assertCouponMemberLevel(ctx, customerId, tpl);
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
    /**
     * A3（coupon.md §8 A1/A3）：整单全额退款后回退券。
     * Vendure 订单无 "Refunded" 态，退款由 Refund 实体走独立状态机到 "Settled"；
     * 故按「该订单累计已 Settled 的退款额 >= 应付总额（totalWithTax）」判定为整单退完，
     * 触发 returnCoupon 回退。部分退（未达全额）不触发。幂等由 returnCoupon 保证。
     */
    async returnCouponOnFullRefund(ctx, refundId) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, core_1.Refund);
        // Refund 仅关联 Payment，订单经 Payment.order 中转
        const refund = await repo
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.payment', 'p')
            .leftJoinAndSelect('p.order', 'o')
            .where('r.id = :id', { id: String(refundId) })
            .getOne();
        const order = (_a = refund === null || refund === void 0 ? void 0 : refund.payment) === null || _a === void 0 ? void 0 : _a.order;
        if (!order)
            return;
        const settled = await repo
            .createQueryBuilder('r')
            .innerJoin('r.payment', 'p')
            .innerJoin('p.order', 'o')
            .where('o.id = :oid', { oid: String(order.id) })
            .andWhere('r.state = :st', { st: 'Settled' })
            .getMany();
        const totalRefunded = (settled !== null && settled !== void 0 ? settled : []).reduce((s, r) => { var _a; return s + Number((_a = r.total) !== null && _a !== void 0 ? _a : 0); }, 0);
        if (Number((_b = order.totalWithTax) !== null && _b !== void 0 ? _b : 0) <= totalRefunded) {
            await this.returnCoupon(ctx, order.id);
        }
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
    async countHeld(customerId, templateId, now = new Date()) {
        // 未跑在具体 ctx 内，用原始连接
        const nowISO = now.toISOString();
        const countRepo = this.connection.rawConnection.getRepository(customer_coupon_entity_1.CustomerCoupon);
        return countRepo
            .createQueryBuilder('cc')
            .where('cc.customerId = :customerId', { customerId })
            .andWhere('cc.templateId = :templateId', { templateId: templateId })
            .andWhere("cc.status IN ('UNUSED','RETURNED')")
            .andWhere('(cc.expiredAt IS NULL OR cc.expiredAt > :now)', { now: nowISO })
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
    /** 新客判定：本租户是否已有历史有效订单（排除创建/购物车/待支付/修改/取消等未完成态） */
    async hasPlacedOrder(ctx, customerId) {
        return !(await (0, coupon_settlement_1.isNewCustomerWithinChannel)(ctx, customerId));
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
                // validDays 券按领取时刻起算过期时间；否则快照模板固定 endsAt
                expiredAt: tpl.validDays ? new Date(Date.now() + tpl.validDays * 86400000) : ((_a = tpl.endsAt) !== null && _a !== void 0 ? _a : undefined),
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
        core_1.ListQueryBuilder,
        coupon_binding_service_1.CouponBindingService])
], CouponService);
//# sourceMappingURL=coupon.service.js.map