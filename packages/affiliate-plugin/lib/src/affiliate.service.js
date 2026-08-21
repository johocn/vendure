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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AffiliateService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shop_plugin_1 = require("@vendure/shop-plugin");
const affiliate_options_1 = require("./affiliate.options");
const affiliate_entity_1 = require("./affiliate.entity");
const affiliate_relation_entity_1 = require("./affiliate-relation.entity");
const affiliate_commission_entity_1 = require("./affiliate-commission.entity");
const affiliate_withdrawal_entity_1 = require("./affiliate-withdrawal.entity");
/** 易读字符集（去 0/O/1/I/L 等易混字符）。 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** 金额 round(base * rate / 1000)。 */
function round(base, rate) {
    return Math.round((base * rate) / 1000);
}
let AffiliateService = class AffiliateService {
    constructor(options, connection, orderService, administratorService) {
        this.options = options;
        this.connection = connection;
        this.orderService = orderService;
        this.administratorService = administratorService;
    }
    // ---------- 店主域鉴权 ----------
    /**
     * 归属解析 + 校验：activeUserId → Administrator.user → Shop.administratorId → status==='active'。
     * 直接仓储查 Shop，勿注入 shop.service（防 DI 环）。
     */
    async requireMyShop(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null)
            throw new core_1.ForbiddenError();
        const shop = await this.connection
            .getRepository(ctx, shop_plugin_1.Shop)
            .findOne({ where: { administratorId: admin.id } });
        if (!shop || shop.status !== 'active')
            throw new core_1.ForbiddenError();
        return shop;
    }
    // ---------- C 端身份 ----------
    /** 当前活跃用户对应的 Customer（按 customer.user.id 关联）；非顾客返回 undefined。 */
    async customerOf(ctx) {
        if (!ctx.activeUserId)
            return undefined;
        const customer = await this.connection
            .getRepository(ctx, core_1.Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } });
        return customer !== null && customer !== void 0 ? customer : undefined;
    }
    // ---------- 推广码 ----------
    /** 生成唯一推广码：时间戳 base36 + 6 位易读随机字符，冲突重试（最多 10 次）。 */
    async genUniqueCode(ctx) {
        const repo = this.connection.getRepository(ctx, affiliate_entity_1.Affiliate);
        for (let i = 0; i < 10; i++) {
            const ts = Date.now().toString(36).toUpperCase();
            let rnd = '';
            for (let j = 0; j < 6; j++) {
                rnd += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
            const code = `${ts}${rnd}`;
            const hit = await repo.findOne({ where: { code } });
            if (!hit)
                return code;
        }
        throw new core_1.UserInputError('Failed to generate a unique affiliate code');
    }
    // ---------- 推广员注册 / 绑定 ----------
    /** 成为推广员：同一 userId 已有则报错；生成 code 并初始化状态与余额。 */
    async becomeAffiliate(ctx, shopId) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const repo = this.connection.getRepository(ctx, affiliate_entity_1.Affiliate);
        const userId = Number(ctx.activeUserId);
        const existing = await repo.findOne({ where: { userId } });
        if (existing)
            throw new core_1.UserInputError('Already an affiliate');
        const affiliate = repo.create({
            channelId: ctx.channelId,
            userId,
            shopId: shopId != null ? Number(shopId) : null,
            code: await this.genUniqueCode(ctx),
            status: 'active',
            totalCommission: 0,
            withdrawableCommission: 0,
        });
        affiliate.channels = [ctx.channel];
        return repo.save(affiliate);
    }
    /** 顾客绑定推广关系：code 查 Affiliate，拦 self-bind，幂等防重复绑定。 */
    async bindRelation(ctx, code, source) {
        if (!ctx.activeUserId)
            throw new core_1.ForbiddenError();
        const customer = await this.customerOf(ctx);
        if (!customer)
            throw new core_1.ForbiddenError();
        const bindSource = source === 'code' || source === 'click' ? source : 'click';
        const affRepo = this.connection.getRepository(ctx, affiliate_entity_1.Affiliate);
        const affiliate = await affRepo.findOne({ where: { code } });
        if (!affiliate)
            throw new core_1.EntityNotFoundError('Affiliate', code);
        if (affiliate.userId === Number(ctx.activeUserId)) {
            throw new core_1.UserInputError('Cannot bind to yourself');
        }
        const relRepo = this.connection.getRepository(ctx, affiliate_relation_entity_1.AffiliateRelation);
        const existing = await relRepo.findOne({ where: { customerId: customer.id } });
        if (existing)
            throw new core_1.UserInputError('Already bound');
        const relation = relRepo.create({
            channelId: ctx.channelId,
            affiliateId: affiliate.id,
            customerId: customer.id,
            bindSource,
            boundAt: new Date(),
        });
        relation.channels = [ctx.channel];
        return relRepo.save(relation);
    }
    // ---------- 佣金 ----------
    /**
     * 幂等生成订单佣金。仅当订单顾客已绑定某 active 推广员、且商品归属店主（shopId 非空）时，
     * 为该行生成佣金项（status pending，loadOn=options.defaultLoadOn）。
     */
    async getOrCreateCommissions(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const orderId = order.id;
        const repo = this.connection.getRepository(ctx, affiliate_commission_entity_1.AffiliateCommissionEntry);
        const existing = await repo.find({ where: { orderId } });
        if (existing.length > 0) {
            return existing; // 幂等：一单一轮最多生成一次
        }
        const fresh = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.product.translations',
        ]);
        if (!fresh)
            return [];
        const customerId = (_a = fresh.customer) === null || _a === void 0 ? void 0 : _a.id;
        if (customerId == null)
            return [];
        const lines = (_b = fresh.lines) !== null && _b !== void 0 ? _b : [];
        if (lines.length === 0)
            return [];
        const relation = await this.connection
            .getRepository(ctx, affiliate_relation_entity_1.AffiliateRelation)
            .findOne({ where: { customerId, channelId: ctx.channelId } });
        if (!relation)
            return [];
        const affRepo = this.connection.getRepository(ctx, affiliate_entity_1.Affiliate);
        const affiliate = await affRepo.findOne({ where: { id: relation.affiliateId } });
        if (!affiliate || affiliate.status !== 'active')
            return [];
        const defaultRate = (_c = this.options.defaultRate) !== null && _c !== void 0 ? _c : affiliate_options_1.AFFILIATE_DEFAULT_RATE;
        const loadOn = (_d = this.options.defaultLoadOn) !== null && _d !== void 0 ? _d : affiliate_options_1.AFFILIATE_DEFAULT_LOAD_ON;
        const entries = [];
        let addedBase = 0;
        let addedCommission = 0;
        for (const line of lines) {
            const product = (_e = line.productVariant) === null || _e === void 0 ? void 0 : _e.product;
            const cf = ((_f = product === null || product === void 0 ? void 0 : product.customFields) !== null && _f !== void 0 ? _f : {});
            const shopIdVal = cf.shopId;
            if (shopIdVal == null)
                continue; // 未归属店铺的商品不计佣金
            const shopId = Number(shopIdVal);
            const rate = this.resolveRate(cf, defaultRate);
            // core 3.6 OrderLine 无 totalWithTax/税字段：用「含税实际小计（含折扣）」作为成交额基数
            const baseAmount = Number((_h = (_g = line.proratedLinePriceWithTax) !== null && _g !== void 0 ? _g : line.linePriceWithTax) !== null && _h !== void 0 ? _h : 0);
            const commissionAmount = round(baseAmount, rate);
            if (commissionAmount <= 0)
                continue;
            const entry = repo.create({
                channelId: ctx.channelId,
                affiliateId: affiliate.id,
                customerId,
                orderId,
                orderLineId: line.id,
                shopId,
                baseAmount,
                rate,
                commissionAmount,
                loadOn,
                status: 'pending',
            });
            entry.channels = [ctx.channel];
            entries.push(entry);
            addedBase += baseAmount;
            addedCommission += commissionAmount;
        }
        const saved = await repo.save(entries);
        if (saved.length > 0 && addedCommission > 0) {
            // 累计佣金与可提现余额随本单佣金入账（pending 即视为可提现基数），与 rollback/reconcile 保持一致
            affiliate.totalCommission = Number((_j = affiliate.totalCommission) !== null && _j !== void 0 ? _j : 0) + addedCommission;
            affiliate.withdrawableCommission =
                Number((_k = affiliate.withdrawableCommission) !== null && _k !== void 0 ? _k : 0) + addedCommission;
            await affRepo.save(affiliate);
        }
        return saved;
    }
    /** 费率解析：cf.affiliateRate（千分比）优先，否则 defaultRate。 */
    resolveRate(cf, defaultRate) {
        const custom = Number(cf.affiliateRate);
        return Number.isFinite(custom) && custom > 0 ? custom : defaultRate;
    }
    /** 订单退款回滚：该单 pending 佣金置 reversed，并回退对应推广员余额。返回处理条数。 */
    async rollbackCommissions(ctx, orderId) {
        var _a, _b;
        const id = Number(orderId);
        const repo = this.connection.getRepository(ctx, affiliate_commission_entity_1.AffiliateCommissionEntry);
        const rows = await repo.find({ where: { orderId: id, status: 'pending' } });
        if (rows.length === 0)
            return 0;
        const byAffiliate = new Map();
        for (const r of rows) {
            r.status = 'reversed';
            byAffiliate.set(r.affiliateId, ((_a = byAffiliate.get(r.affiliateId)) !== null && _a !== void 0 ? _a : 0) + r.commissionAmount);
        }
        await repo.save(rows);
        for (const [affiliateId, amount] of byAffiliate) {
            const aff = await this.connection
                .getRepository(ctx, affiliate_entity_1.Affiliate)
                .findOne({ where: { id: affiliateId } });
            if (aff) {
                aff.withdrawableCommission = Math.max(0, Number((_b = aff.withdrawableCommission) !== null && _b !== void 0 ? _b : 0) - amount);
                await this.connection.getRepository(ctx, affiliate_entity_1.Affiliate).save(aff);
            }
        }
        return rows.length;
    }
    /** 重算可提现余额：pending 佣金总合 - 已支付(pay)提现总合，max(0)。 */
    async reconcileWithdrawable(ctx, affiliateId) {
        const id = Number(affiliateId);
        const commRepo = this.connection.getRepository(ctx, affiliate_commission_entity_1.AffiliateCommissionEntry);
        const wdRepo = this.connection.getRepository(ctx, affiliate_withdrawal_entity_1.AffiliateWithdrawal);
        const pendingRows = await commRepo.find({ where: { affiliateId: id, status: 'pending' } });
        const paidRows = await wdRepo.find({ where: { affiliateId: id, status: 'paid' } });
        const pendingSum = pendingRows.reduce((s, r) => { var _a; return s + Number((_a = r.commissionAmount) !== null && _a !== void 0 ? _a : 0); }, 0);
        const paidSum = paidRows.reduce((s, r) => { var _a; return s + Number((_a = r.amount) !== null && _a !== void 0 ? _a : 0); }, 0);
        return Math.max(0, pendingSum - paidSum);
    }
    // ---------- 我（C 端）查询 ----------
    /** 当前用户的推广员档案。 */
    async myAffiliate(ctx) {
        if (!ctx.activeUserId)
            return undefined;
        const aff = await this.connection
            .getRepository(ctx, affiliate_entity_1.Affiliate)
            .findOne({ where: { userId: Number(ctx.activeUserId) } });
        return aff !== null && aff !== void 0 ? aff : undefined;
    }
    /** 当前用户的佣金明细，createdAt DESC。 */
    async myCommissionEntries(ctx) {
        const aff = await this.myAffiliate(ctx);
        if (!aff)
            return [];
        return this.connection.getRepository(ctx, affiliate_commission_entity_1.AffiliateCommissionEntry).find({
            where: { affiliateId: aff.id },
            order: { createdAt: 'DESC' },
        });
    }
    // ---------- 提现 ----------
    /** 申请提现：校验余额充足后创建 pending 提现单。 */
    async requestWithdrawal(ctx, amount) {
        const aff = await this.myAffiliate(ctx);
        if (!aff)
            throw new core_1.ForbiddenError();
        const available = await this.reconcileWithdrawable(ctx, aff.id);
        if (amount > available) {
            throw new core_1.UserInputError('exceeds available balance');
        }
        const repo = this.connection.getRepository(ctx, affiliate_withdrawal_entity_1.AffiliateWithdrawal);
        const wd = repo.create({
            channelId: ctx.channelId,
            affiliateId: aff.id,
            amount,
            status: 'pending',
        });
        wd.channels = [ctx.channel];
        return repo.save(wd);
    }
    /** 店主支付提现（幂等：非 pending 直接返回）。 */
    async payWithdrawalSafe(ctx, id) {
        await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, affiliate_withdrawal_entity_1.AffiliateWithdrawal);
        const wd = await repo.findOne({ where: { id: Number(id) } });
        if (!wd)
            throw new core_1.EntityNotFoundError('AffiliateWithdrawal', id);
        if (wd.status === 'pending') {
            wd.status = 'paid';
            wd.paidAt = new Date();
            return repo.save(wd);
        }
        return wd; // 幂等：已处理直接返回
    }
    /** 店主拒绝提现（幂等）：pending → 重算回放余额 → rejected。 */
    async rejectWithdrawalSafe(ctx, id) {
        await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, affiliate_withdrawal_entity_1.AffiliateWithdrawal);
        const wd = await repo.findOne({ where: { id: Number(id) } });
        if (!wd)
            throw new core_1.EntityNotFoundError('AffiliateWithdrawal', id);
        if (wd.status === 'pending') {
            // 回放余额：拒绝后重算可提现并写回推广员
            const aff = await this.connection
                .getRepository(ctx, affiliate_entity_1.Affiliate)
                .findOne({ where: { id: wd.affiliateId } });
            if (aff) {
                aff.withdrawableCommission = await this.reconcileWithdrawable(ctx, wd.affiliateId);
                await this.connection.getRepository(ctx, affiliate_entity_1.Affiliate).save(aff);
            }
            wd.status = 'rejected';
            return repo.save(wd);
        }
        return wd; // 幂等：非 pending 直接返回
    }
    // ---------- 管理端列表 ----------
    /** 本 channel 全量推广员。 */
    async affiliates(ctx) {
        return this.connection.getRepository(ctx, affiliate_entity_1.Affiliate).find({
            where: { channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
        });
    }
    /** 本 channel 全量提现单。 */
    async withdrawals(ctx) {
        return this.connection.getRepository(ctx, affiliate_withdrawal_entity_1.AffiliateWithdrawal).find({
            where: { channelId: ctx.channelId },
            order: { createdAt: 'DESC' },
        });
    }
};
exports.AffiliateService = AffiliateService;
exports.AffiliateService = AffiliateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(affiliate_options_1.AFFILIATE_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        core_1.OrderService,
        core_1.AdministratorService])
], AffiliateService);
//# sourceMappingURL=affiliate.service.js.map