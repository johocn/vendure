import { Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    ID,
    Injector,
    Logger,
    PaginatedList,
    ProductService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CouponService } from '@vendure/coupon-plugin';

import { loggerCtx } from './constants';
import { Review } from './review.entity';
import { ReviewAlert, ReviewAlertCouponStatus, ReviewAlertRule, ReviewAlertStatus } from './review-alert.entity';
import { evaluateReviewAlert, normalizeMaxRating } from './review-alert';

const ALERT_STATUSES: ReviewAlertStatus[] = ['new', 'replied', 'closed'];

export interface ReviewAlertRuleLike {
    channelId: number;
    enabled: boolean;
    maxRating: number;
    couponTemplateId: string | null;
}

export interface UpdateReviewAlertRuleInput {
    enabled?: boolean;
    maxRating?: number;
    couponTemplateId?: ID | null;
}

export interface ReviewAlertListOptions {
    skip?: number;
    take?: number;
    status?: string;
}

export interface ReviewAlertStats {
    newCount: number;
    totalCount: number;
    compensatedCount: number;
    /** 近 7 日差评预警数（列表页副标题用） */
    last7dCount: number;
}

/**
 * P4-2 评价品质闭环：
 * 规则读写 → 差评落库即预警（星级触阈 或 正文命中严重项）→ 自动致歉券 → 后台回评/关闭。
 * 任何一步失败都不阻断评价主流程（仅告警 + 落 note，后台可重试）。
 */
@Injectable()
export class ReviewAlertService {
    constructor(
        private connection: TransactionalConnection,
        private productService: ProductService,
        @Optional() private moduleRef?: ModuleRef,
    ) {}

    /** vendure Injector 由 ModuleRef 惰性构造（跨模块解析 Coupon 服务，避免循环依赖） */
    private get injector(): Injector {
        return new Injector(this.moduleRef!);
    }

    /** 渠道规则（未配置返回默认：启用 + 2 星 + 不发券，不落库）。 */
    async getRule(ctx: RequestContext): Promise<ReviewAlertRuleLike> {
        const rule = await this.connection
            .getRepository(ctx, ReviewAlertRule)
            .findOne({ where: { channelId: ctx.channelId as number } as any });
        if (!rule) {
            return { channelId: ctx.channelId as number, enabled: true, maxRating: 2, couponTemplateId: null };
        }
        return {
            channelId: rule.channelId,
            enabled: rule.enabled ?? true,
            maxRating: normalizeMaxRating(rule.maxRating),
            couponTemplateId: rule.couponTemplateId ? String(rule.couponTemplateId) : null,
        };
    }

    /** 更新渠道规则（不存在则创建）。 */
    async updateRule(ctx: RequestContext, input: UpdateReviewAlertRuleInput): Promise<ReviewAlertRuleLike> {
        const repo = this.connection.getRepository(ctx, ReviewAlertRule);
        let rule = await repo.findOne({ where: { channelId: ctx.channelId as number } as any });
        if (!rule) {
            rule = new ReviewAlertRule({
                channelId: ctx.channelId as number,
                enabled: true,
                maxRating: 2,
                couponTemplateId: null,
            } as any);
        }
        if (input.enabled != null) {
            rule.enabled = Boolean(input.enabled);
        }
        if (input.maxRating != null) {
            rule.maxRating = normalizeMaxRating(input.maxRating);
        }
        if (input.couponTemplateId !== undefined) {
            const id = input.couponTemplateId == null ? '' : String(input.couponTemplateId).trim();
            rule.couponTemplateId = id || null;
        }
        const saved = await repo.save(rule);
        return {
            channelId: saved.channelId,
            enabled: saved.enabled ?? true,
            maxRating: normalizeMaxRating(saved.maxRating),
            couponTemplateId: saved.couponTemplateId ? String(saved.couponTemplateId) : null,
        };
    }

    /**
     * 评价落库后调用：命中规则则建预警并尝试自动发致歉券（幂等，同一评价仅一条预警）。
     * 返回 null 表示未命中规则。
     */
    async recordFromReview(ctx: RequestContext, review: Review): Promise<ReviewAlert | null> {
        const rule = await this.getRule(ctx);
        if (!rule.enabled) {
            return null;
        }
        const decision = evaluateReviewAlert(review.rating, review.content, rule.maxRating);
        if (!decision.alert) {
            return null;
        }
        const repo = this.connection.getRepository(ctx, ReviewAlert);
        const existing = await repo.findOne({ where: { reviewId: review.id as number } as any });
        if (existing) {
            return existing;
        }
        let alert = new ReviewAlert({
            reviewId: review.id as number,
            channelId: ctx.channelId as number,
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
        } as any);
        alert = await repo.save(alert);

        if (rule.couponTemplateId) {
            const result = await this.grantApologyCoupon(ctx, alert, rule.couponTemplateId);
            alert.couponStatus = result.status;
            alert.couponCode = result.code;
            alert.note = result.note;
            alert = await repo.save(alert);
        }
        Logger.info(
            `Review alert created for review ${review.id} (tags: ${decision.tags.join('/') || 'none'})`,
            loggerCtx,
        );
        return alert;
    }

    async getAlerts(ctx: RequestContext, options?: ReviewAlertListOptions): Promise<PaginatedList<ReviewAlert>> {
        const status = options?.status?.trim();
        if (status && !ALERT_STATUSES.includes(status as ReviewAlertStatus)) {
            throw new UserInputError('预警状态不合法');
        }
        const take = Math.min(100, Math.max(1, Number(options?.take) || 20));
        const skip = Math.max(0, Number(options?.skip) || 0);
        const where: any = { channelId: ctx.channelId as number };
        if (status) {
            where.status = status;
        }
        const [items, totalItems] = await this.connection.getRepository(ctx, ReviewAlert).findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take,
        });
        return { items, totalItems };
    }

    async getAlert(ctx: RequestContext, id: ID): Promise<ReviewAlert> {
        return this.connection.getEntityOrThrow(ctx, ReviewAlert, id);
    }

    async getStats(ctx: RequestContext): Promise<ReviewAlertStats> {
        const repo = this.connection.getRepository(ctx, ReviewAlert);
        const channelId = ctx.channelId as number;
        const since = new Date(Date.now() - 7 * 86400_000);
        const [newCount, totalCount, compensatedCount, last7dCount] = await Promise.all([
            repo.count({ where: { channelId, status: 'new' } as any }),
            repo.count({ where: { channelId } as any }),
            repo.count({ where: { channelId, couponStatus: 'issued' } as any }),
            repo
                .createQueryBuilder('a')
                .where('a.channelId = :channelId', { channelId })
                .andWhere('a.createdAt >= :since', { since })
                .getCount(),
        ]);
        return { newCount, totalCount, compensatedCount, last7dCount };
    }

    /** 一键回评：写回评价正文回复，预警转「已回评」。 */
    async replyAlert(ctx: RequestContext, id: ID, reply: string): Promise<ReviewAlert> {
        const text = String(reply ?? '').trim();
        if (!text) {
            throw new UserInputError('回复内容不能为空');
        }
        const alert = await this.connection.getEntityOrThrow(ctx, ReviewAlert, id);
        const review = await this.connection.getEntityOrThrow(ctx, Review, alert.reviewId as any);
        review.reply = text;
        review.repliedAt = new Date();
        await this.connection.getRepository(ctx, Review).save(review);

        alert.status = 'replied';
        alert.handledAt = new Date();
        return this.connection.getRepository(ctx, ReviewAlert).save(alert);
    }

    /** 重发/补发致歉券（规则未配券模板时拒绝）。 */
    async resendCoupon(ctx: RequestContext, id: ID): Promise<ReviewAlert> {
        const alert = await this.connection.getEntityOrThrow(ctx, ReviewAlert, id);
        const rule = await this.getRule(ctx);
        if (!rule.couponTemplateId) {
            throw new UserInputError('未配置致歉券模板，请先在预警规则中设置');
        }
        const result = await this.grantApologyCoupon(ctx, alert, rule.couponTemplateId);
        alert.couponStatus = result.status;
        alert.couponCode = result.code;
        alert.note = result.note;
        if (result.status === 'issued') {
            alert.status = 'replied';
            alert.handledAt = new Date();
        }
        return this.connection.getRepository(ctx, ReviewAlert).save(alert);
    }

    /** 关闭预警（赔礼/线下已沟通等），仅留处置备注。 */
    async closeAlert(ctx: RequestContext, id: ID, note?: string | null): Promise<ReviewAlert> {
        const alert = await this.connection.getEntityOrThrow(ctx, ReviewAlert, id);
        alert.status = 'closed';
        alert.note = String(note ?? '').trim() || alert.note;
        alert.handledAt = new Date();
        return this.connection.getRepository(ctx, ReviewAlert).save(alert);
    }

    /** 预警卡片展示的商品名（本地化，取不到返回 null）。 */
    async getProductName(ctx: RequestContext, alert: ReviewAlert): Promise<string | null> {
        try {
            const product = await this.productService.findOne(ctx, alert.productId as any);
            return product?.name ?? null;
        } catch {
            return null;
        }
    }

    private async grantApologyCoupon(
        ctx: RequestContext,
        alert: ReviewAlert,
        templateId: string,
    ): Promise<{ status: ReviewAlertCouponStatus; code: string | null; note: string | null }> {
        try {
            const results = await this.injector
                .get(CouponService)
                .grantCouponIssue(ctx, templateId as any, [alert.customerId as any], false, { issuedBy: 'ADMIN' });
            const first = results?.[0];
            if (first?.ok && first.code) {
                return { status: 'issued', code: first.code, note: null };
            }
            const reason = first?.reason ?? 'UNKNOWN';
            Logger.warn(`apology coupon not granted for alert ${alert.id}: ${reason}`, loggerCtx);
            return { status: 'failed', code: null, note: `发券未成功：${reason}` };
        } catch (e: any) {
            Logger.warn(`grantCouponIssue failed for alert ${alert.id}: ${e?.message ?? e}`, loggerCtx);
            return { status: 'failed', code: null, note: `发券异常：${e?.message ?? e}` };
        }
    }
}
