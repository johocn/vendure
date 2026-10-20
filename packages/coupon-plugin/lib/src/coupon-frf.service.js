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
exports.CouponFrFService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const coupon_service_1 = require("./coupon.service");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const coupon_daily_claim_record_entity_1 = require("./coupon-daily-claim-record.entity");
const coupon_frf_1 = require("./coupon-frf");
const constants_1 = require("./constants");
const SOLD_OUT_MSG = 'sold out';
const isSoldOutError = (e) => { var _a, _b; return String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : '').includes(SOLD_OUT_MSG) || String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : '').includes('Coupon sold out'); };
/**
 * FR-F 服务：每日领券（F1）/ 神券日限量抢（F2）/ 支付有礼（F3）。
 * 复用 P1 机制：R2 原子限量（issueForProgram）、R3 幂等（唯一索引 + 同事务）、R4 防骚扰（冷却去重）、
 * R1 issuedBy 留痕（DAILY / FLASH / PAYGIFT）、R5 渠道隔离（配置按 ctx.channelId 读取）。
 */
let CouponFrFService = class CouponFrFService {
    constructor(connection, couponService) {
        this.connection = connection;
        this.couponService = couponService;
    }
    /** 渠道 customFields 中指定配置原文 */
    async loadRawConfig(ctx, field) {
        var _a, _b;
        const channel = await this.connection
            .getRepository(ctx, 'Channel')
            .createQueryBuilder('ch')
            .where('ch.id = :id', { id: ctx.channelId })
            .getOne();
        return (_b = (_a = channel === null || channel === void 0 ? void 0 : channel.customFields) === null || _a === void 0 ? void 0 : _a[field]) !== null && _b !== void 0 ? _b : null;
    }
    /** 当前请求 customerId（匿名 null） */
    async currentCustomerId(ctx) {
        var _a;
        if (!ctx.activeUserId)
            return null;
        const customer = await this.connection
            .getRepository(ctx, 'Customer')
            .findOne({ where: { user: { id: ctx.activeUserId } } });
        return (_a = customer === null || customer === void 0 ? void 0 : customer.id) !== null && _a !== void 0 ? _a : null;
    }
    /** 模板归属校验（与裂变同口径）：enabled 且渠道含本渠道 */
    isOwn(ctx, t) {
        var _a;
        return t.enabled && ((_a = t.channels) !== null && _a !== void 0 ? _a : []).some(c => c.id === ctx.channelId);
    }
    /* ------------------------- FR-F1 每日领券 ------------------------- */
    /** 每日领券活动视图（匿名可查；claimedToday 仅登录态计算） */
    async dailyClaimActivity(ctx) {
        var _a, _b;
        const raw = await this.loadRawConfig(ctx, 'couponDailyClaim');
        const templates = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).find({
            where: { id: (0, typeorm_1.In)(((_b = (_a = (0, coupon_frf_1.parseCouponDailyClaimConfig)(raw)) === null || _a === void 0 ? void 0 : _a.templateIds) !== null && _b !== void 0 ? _b : [-1])) },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = (0, coupon_frf_1.resolveActiveDailyClaim)(raw, own, new Date(), ctx.languageCode);
        if (!view)
            return null;
        const customerId = await this.currentCustomerId(ctx);
        let claimedTodayIds = new Set();
        if (customerId) {
            const date = (0, coupon_frf_1.claimDateUtc8)();
            const records = await this.connection.getRepository(ctx, coupon_daily_claim_record_entity_1.CouponDailyClaimRecord).find({
                where: {
                    channelId: ctx.channelId,
                    customerId,
                    claimDate: date,
                    templateId: (0, typeorm_1.In)(view.templates.map(t => Number(t.id))),
                },
            });
            claimedTodayIds = new Set(records.map(r => r.templateId));
        }
        return {
            name: view.name,
            subtitle: view.subtitle,
            rules: view.rules,
            startsAt: view.startsAt,
            endsAt: view.endsAt,
            items: view.templates.map(t => ({
                template: t,
                claimedToday: claimedTodayIds.has(Number(t.id)),
                soldOut: t.totalCount > 0 && t.claimedCount >= t.totalCount,
            })),
        };
    }
    /** 每日领券（登录）：每人每券每天 1 张（UTC+8 业务日），R3 幂等 = 唯一索引 + 同事务。 */
    async claimDaily(ctx, templateId) {
        var _a, _b, _c;
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            return { status: 'NOT_LOGGED_IN', coupon: null };
        }
        await this.couponService.expireDueCoupons(ctx, customerId);
        const raw = await this.loadRawConfig(ctx, 'couponDailyClaim');
        const cfg = (0, coupon_frf_1.parseCouponDailyClaimConfig)(raw);
        if (!cfg) {
            return { status: 'INACTIVE', coupon: null };
        }
        // 窗口细分（未开始/已结束/禁用）
        const ws = (0, coupon_frf_1.windowState)(cfg.startsAt, cfg.endsAt, new Date());
        if (!cfg.enabled || ws === 'PENDING')
            return { status: 'NOT_STARTED', coupon: null };
        if (ws === 'ENDED')
            return { status: 'ENDED', coupon: null };
        const templates = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).find({
            where: { id: (0, typeorm_1.In)(cfg.templateIds) },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = (0, coupon_frf_1.resolveActiveDailyClaim)(raw, own, new Date(), ctx.languageCode);
        const tpl = view === null || view === void 0 ? void 0 : view.templates.find(t => Number(t.id) === Math.floor(Number(templateId)));
        if (!view || !tpl) {
            return { status: 'NOT_IN_ACTIVITY', coupon: null };
        }
        // 通用领取前校验：perUserLimit + 会员等级（R2/E2）
        const blocked = await this.couponService.assertCustomerCanClaim(ctx, customerId, tpl);
        if (blocked) {
            return { status: blocked, coupon: null };
        }
        // 预查当天记录（幂等快路径）
        const date = (0, coupon_frf_1.claimDateUtc8)();
        const recordRepo = this.connection.getRepository(ctx, coupon_daily_claim_record_entity_1.CouponDailyClaimRecord);
        const existing = await recordRepo.findOne({
            where: {
                channelId: ctx.channelId,
                customerId,
                templateId: Number(tpl.id),
                claimDate: date,
            },
        });
        if (existing) {
            const coupon = existing.couponId
                ? await this.connection.getRepository(ctx, customer_coupon_entity_1.CustomerCoupon).findOne({ where: { id: existing.couponId } })
                : null;
            return { status: 'ALREADY_CLAIMED', coupon: coupon !== null && coupon !== void 0 ? coupon : null };
        }
        // 事务化发券（R3）：扣量 → 建券 → 落记录（唯一索引兜底），任一步失败整体回滚
        try {
            return await this.connection.withTransaction(ctx, async (txCtx) => {
                const recordRepoTx = this.connection.getRepository(txCtx, coupon_daily_claim_record_entity_1.CouponDailyClaimRecord);
                const existingInTx = await recordRepoTx.findOne({
                    where: {
                        channelId: txCtx.channelId,
                        customerId,
                        templateId: Number(tpl.id),
                        claimDate: date,
                    },
                });
                if (existingInTx) {
                    const coupon = existingInTx.couponId
                        ? await this.connection.getRepository(txCtx, customer_coupon_entity_1.CustomerCoupon).findOne({ where: { id: existingInTx.couponId } })
                        : null;
                    return { status: 'ALREADY_CLAIMED', coupon: coupon !== null && coupon !== void 0 ? coupon : null };
                }
                const coupon = await this.couponService.issueForProgram(txCtx, customerId, tpl, 'DAILY');
                await recordRepoTx.save(new coupon_daily_claim_record_entity_1.CouponDailyClaimRecord({
                    channelId: txCtx.channelId,
                    customerId,
                    templateId: Number(tpl.id),
                    claimDate: date,
                    couponId: coupon.id,
                }));
                core_1.Logger.info(`daily claim ok: customer=${customerId} template=${tpl.id} date=${date}`, constants_1.loggerCtx);
                return { status: 'OK', coupon };
            });
        }
        catch (e) {
            if (String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : '').includes('UNIQUE') || String((_b = e === null || e === void 0 ? void 0 : e.code) !== null && _b !== void 0 ? _b : '') === '23505') {
                // 并发下唯一索引冲突 = 当天已领（R3 幂等）
                core_1.Logger.warn(`daily claim conflict for customer ${customerId}: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, constants_1.loggerCtx);
                return { status: 'ALREADY_CLAIMED', coupon: null };
            }
            if (isSoldOutError(e)) {
                return { status: 'SOLD_OUT', coupon: null };
            }
            throw e;
        }
    }
    /* ------------------------ FR-F2 神券日限量抢 ------------------------ */
    /** 神券日活动视图（匿名可查；myClaimed 仅登录态计算） */
    async flashSaleActivity(ctx) {
        const raw = await this.loadRawConfig(ctx, 'couponFlashSale');
        const cfg = (0, coupon_frf_1.parseCouponFlashSaleConfig)(raw);
        if (!cfg)
            return null;
        const templates = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).find({
            where: { id: (0, typeorm_1.In)(cfg.templateIds) },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = (0, coupon_frf_1.resolveActiveFlashSale)(raw, own, new Date(), ctx.languageCode);
        if (!view)
            return null;
        const customerId = await this.currentCustomerId(ctx);
        const myClaimed = new Map();
        if (customerId) {
            const rows = await this.countFlashClaims(ctx, customerId, view.startsAt, view.endsAt, view.templates.map(t => Number(t.id)));
            for (const r of rows)
                myClaimed.set(r.templateId, r.cnt);
        }
        return {
            name: view.name,
            subtitle: view.subtitle,
            rules: view.rules,
            startsAt: view.startsAt,
            endsAt: view.endsAt,
            perUserLimit: view.perUserLimit,
            items: view.templates.map(t => {
                var _a;
                return ({
                    template: t,
                    soldOut: t.totalCount > 0 && t.claimedCount >= t.totalCount,
                    myClaimed: (_a = myClaimed.get(Number(t.id))) !== null && _a !== void 0 ? _a : 0,
                });
            }),
        };
    }
    /** 场次窗内 FLASH 发券计数（按模板分组） */
    async countFlashClaims(ctx, customerId, startsAt, endsAt, templateIds) {
        if (!templateIds.length)
            return [];
        const rows = await this.connection
            .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
            .createQueryBuilder('cc')
            .select('cc.templateId', 'templateId')
            .addSelect('COUNT(*)', 'cnt')
            .where('cc.customerId = :customerId', { customerId })
            .andWhere('cc.templateId IN (:...templateIds)', { templateIds })
            .andWhere("cc.issuedBy = 'FLASH'")
            .andWhere('cc.createdAt >= :startsAt AND cc.createdAt <= :endsAt', { startsAt, endsAt })
            .groupBy('cc.templateId')
            .getRawMany();
        return rows.map(r => ({ templateId: Number(r.templateId), cnt: Number(r.cnt) }));
    }
    /** 神券日抢券（登录）：时间窗硬拦 + 场次内限抢 + R2 原子限量（超发不可能）。 */
    async claimFlash(ctx, templateId) {
        var _a, _b;
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            return { status: 'NOT_LOGGED_IN', coupon: null };
        }
        await this.couponService.expireDueCoupons(ctx, customerId);
        const raw = await this.loadRawConfig(ctx, 'couponFlashSale');
        const cfg = (0, coupon_frf_1.parseCouponFlashSaleConfig)(raw);
        if (!cfg) {
            return { status: 'INACTIVE', coupon: null };
        }
        // 窗口细分（B1）
        const ws = (0, coupon_frf_1.windowState)(cfg.startsAt, cfg.endsAt, new Date());
        if (ws === 'PENDING')
            return { status: 'NOT_STARTED', coupon: null };
        if (ws === 'ENDED')
            return { status: 'ENDED', coupon: null };
        const templates = await this.connection.getRepository(ctx, coupon_template_entity_1.CouponTemplate).find({
            where: { id: (0, typeorm_1.In)(cfg.templateIds) },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = (0, coupon_frf_1.resolveActiveFlashSale)(raw, own, new Date(), ctx.languageCode);
        const tpl = view === null || view === void 0 ? void 0 : view.templates.find(t => Number(t.id) === Math.floor(Number(templateId)));
        if (!view || !tpl) {
            return { status: 'NOT_IN_ACTIVITY', coupon: null };
        }
        // 通用领取前校验（模板级 perUserLimit + 会员等级）
        const blocked = await this.couponService.assertCustomerCanClaim(ctx, customerId, tpl);
        if (blocked) {
            return { status: blocked, coupon: null };
        }
        // 场次内限抢（B3）：窗内 FLASH 同券计数 ≥ perUserLimit 拒绝
        const claimed = await this.countFlashClaims(ctx, customerId, view.startsAt, view.endsAt, [Number(tpl.id)]);
        const myCount = (_b = (_a = claimed[0]) === null || _a === void 0 ? void 0 : _a.cnt) !== null && _b !== void 0 ? _b : 0;
        if (myCount >= view.perUserLimit) {
            return { status: 'PER_USER_LIMIT', coupon: null };
        }
        // R2 原子限量：超发不可能；售罄稳定失败（B2）
        try {
            const coupon = await this.couponService.issueForProgram(ctx, customerId, tpl, 'FLASH');
            core_1.Logger.info(`flash claim ok: customer=${customerId} template=${tpl.id}`, constants_1.loggerCtx);
            return { status: 'OK', coupon };
        }
        catch (e) {
            if (isSoldOutError(e)) {
                return { status: 'SOLD_OUT', coupon: null };
            }
            throw e;
        }
    }
    /* --------------------------- FR-F3 支付有礼 --------------------------- */
    /**
     * 支付有礼（FR-F3）：订单 PaymentSettled 事件回调。
     * 静默原则（C4）：任何不满足/失败都只留日志、绝不抛错阻塞支付流程。
     * 幂等：cooldownDays ≥ 1 冷却去重（R4）+ issueForProgram 原子扣量，重复事件不会重复发券。
     */
    async payGiftOnOrderSettled(ctx, order) {
        var _a, _b;
        try {
            const raw = await this.loadRawConfig(ctx, 'couponPayGift');
            const cfg = (0, coupon_frf_1.parseCouponPayGiftConfig)(raw);
            if (!cfg)
                return;
            const customerId = order.customerId;
            if (!customerId)
                return;
            // 实付门槛（分；C2）
            if (!(0, coupon_frf_1.payGiftEligible)(cfg, Number(order.totalWithTax) || 0)) {
                core_1.Logger.info(`pay gift skip: order ${order.id} total ${order.totalWithTax} below minAmount ${cfg.minAmount}`, constants_1.loggerCtx);
                return;
            }
            const tpl = await this.connection
                .getRepository(ctx, coupon_template_entity_1.CouponTemplate)
                .findOne({ where: { id: cfg.templateId }, relations: { channels: true } });
            if (!tpl || !this.isOwn(ctx, tpl)) {
                core_1.Logger.warn(`pay gift skip: template ${cfg.templateId} not usable on channel ${ctx.channelId}`, constants_1.loggerCtx);
                return;
            }
            // 冷却防骚扰（R4/C3）：同模板 PAYGIFT cooldownDays 内已发过则跳过
            const since = new Date(Date.now() - cfg.cooldownDays * 86400000);
            const recent = await this.connection
                .getRepository(ctx, customer_coupon_entity_1.CustomerCoupon)
                .createQueryBuilder('cc')
                .where('cc.customerId = :customerId', { customerId })
                .andWhere('cc.templateId = :templateId', { templateId: tpl.id })
                .andWhere("cc.issuedBy = 'PAYGIFT'")
                .andWhere('cc.createdAt >= :since', { since })
                .getCount();
            if (recent > 0) {
                core_1.Logger.info(`pay gift skip (RECENTLY_GRANTED): customer=${customerId} template=${tpl.id} cooldown=${cfg.cooldownDays}d`, constants_1.loggerCtx);
                return;
            }
            const blocked = await this.couponService.assertCustomerCanClaim(ctx, customerId, tpl);
            if (blocked) {
                core_1.Logger.info(`pay gift skip (${blocked}): customer=${customerId} template=${tpl.id}`, constants_1.loggerCtx);
                return;
            }
            try {
                const coupon = await this.couponService.issueForProgram(ctx, customerId, tpl, 'PAYGIFT');
                core_1.Logger.info(`pay gift issued: order=${order.id} customer=${customerId} coupon=${coupon.code}`, constants_1.loggerCtx);
            }
            catch (e) {
                // 售罄（C5）等发放失败静默跳过
                core_1.Logger.warn(`pay gift issue failed for order ${order.id}: ${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
            }
        }
        catch (e) {
            core_1.Logger.warn(`pay gift processing failed for order ${order.id}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
        }
    }
};
exports.CouponFrFService = CouponFrFService;
exports.CouponFrFService = CouponFrFService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        coupon_service_1.CouponService])
], CouponFrFService);
//# sourceMappingURL=coupon-frf.service.js.map