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
exports.ReviewAlertService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const constants_1 = require("./constants");
const review_entity_1 = require("./review.entity");
const review_alert_entity_1 = require("./review-alert.entity");
const review_alert_1 = require("./review-alert");
const ALERT_STATUSES = ['new', 'replied', 'closed'];
/**
 * P4-2 评价品质闭环：
 * 规则读写 → 差评落库即预警（星级触阈 或 正文命中严重项）→ 自动致歉券 → 后台回评/关闭。
 * 任何一步失败都不阻断评价主流程（仅告警 + 落 note，后台可重试）。
 */
let ReviewAlertService = class ReviewAlertService {
    constructor(connection, productService, moduleRef) {
        this.connection = connection;
        this.productService = productService;
        this.moduleRef = moduleRef;
    }
    /** vendure Injector 由 ModuleRef 惰性构造（跨模块解析 Coupon 服务，避免循环依赖） */
    get injector() {
        return new core_2.Injector(this.moduleRef);
    }
    /** 渠道规则（未配置返回默认：启用 + 2 星 + 不发券，不落库）。 */
    async getRule(ctx) {
        var _a;
        const rule = await this.connection
            .getRepository(ctx, review_alert_entity_1.ReviewAlertRule)
            .findOne({ where: { channelId: ctx.channelId } });
        if (!rule) {
            return { channelId: ctx.channelId, enabled: true, maxRating: 2, couponTemplateId: null };
        }
        return {
            channelId: rule.channelId,
            enabled: (_a = rule.enabled) !== null && _a !== void 0 ? _a : true,
            maxRating: (0, review_alert_1.normalizeMaxRating)(rule.maxRating),
            couponTemplateId: rule.couponTemplateId ? String(rule.couponTemplateId) : null,
        };
    }
    /** 更新渠道规则（不存在则创建）。 */
    async updateRule(ctx, input) {
        var _a;
        const repo = this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlertRule);
        let rule = await repo.findOne({ where: { channelId: ctx.channelId } });
        if (!rule) {
            rule = new review_alert_entity_1.ReviewAlertRule({
                channelId: ctx.channelId,
                enabled: true,
                maxRating: 2,
                couponTemplateId: null,
            });
        }
        if (input.enabled != null) {
            rule.enabled = Boolean(input.enabled);
        }
        if (input.maxRating != null) {
            rule.maxRating = (0, review_alert_1.normalizeMaxRating)(input.maxRating);
        }
        if (input.couponTemplateId !== undefined) {
            const id = input.couponTemplateId == null ? '' : String(input.couponTemplateId).trim();
            rule.couponTemplateId = id || null;
        }
        const saved = await repo.save(rule);
        return {
            channelId: saved.channelId,
            enabled: (_a = saved.enabled) !== null && _a !== void 0 ? _a : true,
            maxRating: (0, review_alert_1.normalizeMaxRating)(saved.maxRating),
            couponTemplateId: saved.couponTemplateId ? String(saved.couponTemplateId) : null,
        };
    }
    /**
     * 评价落库后调用：命中规则则建预警并尝试自动发致歉券（幂等，同一评价仅一条预警）。
     * 返回 null 表示未命中规则。
     */
    async recordFromReview(ctx, review) {
        const rule = await this.getRule(ctx);
        if (!rule.enabled) {
            return null;
        }
        const decision = (0, review_alert_1.evaluateReviewAlert)(review.rating, review.content, rule.maxRating);
        if (!decision.alert) {
            return null;
        }
        const repo = this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlert);
        const existing = await repo.findOne({ where: { reviewId: review.id } });
        if (existing) {
            return existing;
        }
        let alert = new review_alert_entity_1.ReviewAlert({
            reviewId: review.id,
            channelId: ctx.channelId,
            productId: review.productId,
            customerId: review.customerId,
            rating: review.rating,
            content: review.content,
            tags: decision.tags.length ? decision.tags : null,
            couponStatus: 'none',
            couponCode: null,
            status: 'new',
            note: null,
            handledAt: null,
        });
        alert = await repo.save(alert);
        if (rule.couponTemplateId) {
            const result = await this.grantApologyCoupon(ctx, alert, rule.couponTemplateId);
            alert.couponStatus = result.status;
            alert.couponCode = result.code;
            alert.note = result.note;
            alert = await repo.save(alert);
        }
        core_2.Logger.info(`Review alert created for review ${review.id} (tags: ${decision.tags.join('/') || 'none'})`, constants_1.loggerCtx);
        return alert;
    }
    async getAlerts(ctx, options) {
        var _a;
        const status = (_a = options === null || options === void 0 ? void 0 : options.status) === null || _a === void 0 ? void 0 : _a.trim();
        if (status && !ALERT_STATUSES.includes(status)) {
            throw new core_2.UserInputError('预警状态不合法');
        }
        const take = Math.min(100, Math.max(1, Number(options === null || options === void 0 ? void 0 : options.take) || 20));
        const skip = Math.max(0, Number(options === null || options === void 0 ? void 0 : options.skip) || 0);
        const where = { channelId: ctx.channelId };
        if (status) {
            where.status = status;
        }
        const [items, totalItems] = await this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlert).findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take,
        });
        return { items, totalItems };
    }
    async getAlert(ctx, id) {
        return this.connection.getEntityOrThrow(ctx, review_alert_entity_1.ReviewAlert, id);
    }
    async getStats(ctx) {
        const repo = this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlert);
        const channelId = ctx.channelId;
        const since = new Date(Date.now() - 7 * 86400000);
        const [newCount, totalCount, compensatedCount, last7dCount] = await Promise.all([
            repo.count({ where: { channelId, status: 'new' } }),
            repo.count({ where: { channelId } }),
            repo.count({ where: { channelId, couponStatus: 'issued' } }),
            repo
                .createQueryBuilder('a')
                .where('a.channelId = :channelId', { channelId })
                .andWhere('a.createdAt >= :since', { since })
                .getCount(),
        ]);
        return { newCount, totalCount, compensatedCount, last7dCount };
    }
    /** 一键回评：写回评价正文回复，预警转「已回评」。 */
    async replyAlert(ctx, id, reply) {
        const text = String(reply !== null && reply !== void 0 ? reply : '').trim();
        if (!text) {
            throw new core_2.UserInputError('回复内容不能为空');
        }
        const alert = await this.connection.getEntityOrThrow(ctx, review_alert_entity_1.ReviewAlert, id);
        const review = await this.connection.getEntityOrThrow(ctx, review_entity_1.Review, alert.reviewId);
        review.reply = text;
        review.repliedAt = new Date();
        await this.connection.getRepository(ctx, review_entity_1.Review).save(review);
        alert.status = 'replied';
        alert.handledAt = new Date();
        return this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlert).save(alert);
    }
    /** 重发/补发致歉券（规则未配券模板时拒绝）。 */
    async resendCoupon(ctx, id) {
        const alert = await this.connection.getEntityOrThrow(ctx, review_alert_entity_1.ReviewAlert, id);
        const rule = await this.getRule(ctx);
        if (!rule.couponTemplateId) {
            throw new core_2.UserInputError('未配置致歉券模板，请先在预警规则中设置');
        }
        const result = await this.grantApologyCoupon(ctx, alert, rule.couponTemplateId);
        alert.couponStatus = result.status;
        alert.couponCode = result.code;
        alert.note = result.note;
        if (result.status === 'issued') {
            alert.status = 'replied';
            alert.handledAt = new Date();
        }
        return this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlert).save(alert);
    }
    /** 关闭预警（赔礼/线下已沟通等），仅留处置备注。 */
    async closeAlert(ctx, id, note) {
        const alert = await this.connection.getEntityOrThrow(ctx, review_alert_entity_1.ReviewAlert, id);
        alert.status = 'closed';
        alert.note = String(note !== null && note !== void 0 ? note : '').trim() || alert.note;
        alert.handledAt = new Date();
        return this.connection.getRepository(ctx, review_alert_entity_1.ReviewAlert).save(alert);
    }
    /** 预警卡片展示的商品名（本地化，取不到返回 null）。 */
    async getProductName(ctx, alert) {
        var _a;
        try {
            const product = await this.productService.findOne(ctx, alert.productId);
            return (_a = product === null || product === void 0 ? void 0 : product.name) !== null && _a !== void 0 ? _a : null;
        }
        catch (_b) {
            return null;
        }
    }
    async grantApologyCoupon(ctx, alert, templateId) {
        var _a, _b, _c;
        try {
            const results = await this.injector
                .get(coupon_plugin_1.CouponService)
                .grantCouponIssue(ctx, templateId, [alert.customerId], false, { issuedBy: 'ADMIN' });
            const first = results === null || results === void 0 ? void 0 : results[0];
            if ((first === null || first === void 0 ? void 0 : first.ok) && first.code) {
                return { status: 'issued', code: first.code, note: null };
            }
            const reason = (_a = first === null || first === void 0 ? void 0 : first.reason) !== null && _a !== void 0 ? _a : 'UNKNOWN';
            core_2.Logger.warn(`apology coupon not granted for alert ${alert.id}: ${reason}`, constants_1.loggerCtx);
            return { status: 'failed', code: null, note: `发券未成功：${reason}` };
        }
        catch (e) {
            core_2.Logger.warn(`grantCouponIssue failed for alert ${alert.id}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
            return { status: 'failed', code: null, note: `发券异常：${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}` };
        }
    }
};
exports.ReviewAlertService = ReviewAlertService;
exports.ReviewAlertService = ReviewAlertService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [core_2.TransactionalConnection,
        core_2.ProductService,
        core_1.ModuleRef])
], ReviewAlertService);
//# sourceMappingURL=review-alert.service.js.map