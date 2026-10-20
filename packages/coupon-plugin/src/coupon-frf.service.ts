import { Injectable } from '@nestjs/common';
import { Logger, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { CouponDailyClaimRecord } from './coupon-daily-claim-record.entity';
import {
    CouponDailyClaimView,
    CouponFlashSaleView,
    claimDateUtc8,
    parseCouponDailyClaimConfig,
    parseCouponFlashSaleConfig,
    parseCouponPayGiftConfig,
    payGiftEligible,
    resolveActiveDailyClaim,
    resolveActiveFlashSale,
    windowState,
} from './coupon-frf';
import { loggerCtx } from './constants';

/** C 端每日领券条目视图：模板 + 今日是否已领 + 是否售罄 */
export interface DailyClaimItemView {
    template: CouponTemplate;
    claimedToday: boolean;
    soldOut: boolean;
}

export interface DailyClaimActivityView extends Omit<CouponDailyClaimView<CouponTemplate>, 'templates'> {
    items: DailyClaimItemView[];
}

/** C 端神券日条目视图：模板 + 是否售罄 + 本场次我已抢张数 */
export interface FlashSaleItemView {
    template: CouponTemplate;
    soldOut: boolean;
    myClaimed: number;
}

export interface FlashSaleActivityView extends Omit<CouponFlashSaleView<CouponTemplate>, 'templates'> {
    items: FlashSaleItemView[];
}

export interface FrfClaimResult {
    status: string;
    coupon: CustomerCoupon | null;
}

const SOLD_OUT_MSG = 'sold out';
const isSoldOutError = (e: any): boolean =>
    String(e?.message ?? '').includes(SOLD_OUT_MSG) || String(e?.message ?? '').includes('Coupon sold out');

/**
 * FR-F 服务：每日领券（F1）/ 神券日限量抢（F2）/ 支付有礼（F3）。
 * 复用 P1 机制：R2 原子限量（issueForProgram）、R3 幂等（唯一索引 + 同事务）、R4 防骚扰（冷却去重）、
 * R1 issuedBy 留痕（DAILY / FLASH / PAYGIFT）、R5 渠道隔离（配置按 ctx.channelId 读取）。
 */
@Injectable()
export class CouponFrFService {
    constructor(
        private connection: TransactionalConnection,
        private couponService: CouponService,
    ) {}

    /** 渠道 customFields 中指定配置原文 */
    private async loadRawConfig(ctx: RequestContext, field: string): Promise<unknown> {
        const channel = await this.connection
            .getRepository(ctx, 'Channel' as any)
            .createQueryBuilder('ch')
            .where('ch.id = :id', { id: ctx.channelId })
            .getOne();
        return (channel as any)?.customFields?.[field] ?? null;
    }

    /** 当前请求 customerId（匿名 null） */
    private async currentCustomerId(ctx: RequestContext): Promise<number | null> {
        if (!ctx.activeUserId) return null;
        const customer = await this.connection
            .getRepository(ctx, 'Customer' as any)
            .findOne({ where: { user: { id: ctx.activeUserId } } } as any);
        return (customer?.id as number) ?? null;
    }

    /** 模板归属校验（与裂变同口径）：enabled 且渠道含本渠道 */
    private isOwn(ctx: RequestContext, t: CouponTemplate): boolean {
        return t.enabled && (t.channels ?? []).some(c => c.id === ctx.channelId);
    }

    /* ------------------------- FR-F1 每日领券 ------------------------- */

    /** 每日领券活动视图（匿名可查；claimedToday 仅登录态计算） */
    async dailyClaimActivity(ctx: RequestContext): Promise<DailyClaimActivityView | null> {
        const raw = await this.loadRawConfig(ctx, 'couponDailyClaim');
        const templates = await this.connection.getRepository(ctx, CouponTemplate).find({
            where: { id: In((parseCouponDailyClaimConfig(raw)?.templateIds ?? [-1])) as any },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = resolveActiveDailyClaim(raw, own, new Date(), ctx.languageCode);
        if (!view) return null;
        const customerId = await this.currentCustomerId(ctx);
        let claimedTodayIds = new Set<number>();
        if (customerId) {
            const date = claimDateUtc8();
            const records = await this.connection.getRepository(ctx, CouponDailyClaimRecord).find({
                where: {
                    channelId: ctx.channelId as number,
                    customerId,
                    claimDate: date,
                    templateId: In(view.templates.map(t => Number(t.id))) as any,
                } as any,
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
    async claimDaily(ctx: RequestContext, templateId: number): Promise<FrfClaimResult> {
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            return { status: 'NOT_LOGGED_IN', coupon: null };
        }
        await this.couponService.expireDueCoupons(ctx, customerId);
        const raw = await this.loadRawConfig(ctx, 'couponDailyClaim');
        const cfg = parseCouponDailyClaimConfig(raw);
        if (!cfg) {
            return { status: 'INACTIVE', coupon: null };
        }
        // 窗口细分（未开始/已结束/禁用）
        const ws = windowState(cfg.startsAt, cfg.endsAt, new Date());
        if (!cfg.enabled || ws === 'PENDING') return { status: 'NOT_STARTED', coupon: null };
        if (ws === 'ENDED') return { status: 'ENDED', coupon: null };
        const templates = await this.connection.getRepository(ctx, CouponTemplate).find({
            where: { id: In(cfg.templateIds) as any },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = resolveActiveDailyClaim(raw, own, new Date(), ctx.languageCode);
        const tpl = view?.templates.find(t => Number(t.id) === Math.floor(Number(templateId)));
        if (!view || !tpl) {
            return { status: 'NOT_IN_ACTIVITY', coupon: null };
        }
        // 通用领取前校验：perUserLimit + 会员等级（R2/E2）
        const blocked = await this.couponService.assertCustomerCanClaim(ctx, customerId, tpl);
        if (blocked) {
            return { status: blocked, coupon: null };
        }
        // 预查当天记录（幂等快路径）
        const date = claimDateUtc8();
        const recordRepo = this.connection.getRepository(ctx, CouponDailyClaimRecord);
        const existing = await recordRepo.findOne({
            where: {
                channelId: ctx.channelId as number,
                customerId,
                templateId: Number(tpl.id),
                claimDate: date,
            } as any,
        });
        if (existing) {
            const coupon = existing.couponId
                ? await this.connection.getRepository(ctx, CustomerCoupon).findOne({ where: { id: existing.couponId as any } })
                : null;
            return { status: 'ALREADY_CLAIMED', coupon: coupon ?? null };
        }
        // 事务化发券（R3）：扣量 → 建券 → 落记录（唯一索引兜底），任一步失败整体回滚
        try {
            return await this.connection.withTransaction(ctx, async txCtx => {
                const recordRepoTx = this.connection.getRepository(txCtx, CouponDailyClaimRecord);
                const existingInTx = await recordRepoTx.findOne({
                    where: {
                        channelId: txCtx.channelId as number,
                        customerId,
                        templateId: Number(tpl.id),
                        claimDate: date,
                    } as any,
                });
                if (existingInTx) {
                    const coupon = existingInTx.couponId
                        ? await this.connection.getRepository(txCtx, CustomerCoupon).findOne({ where: { id: existingInTx.couponId as any } })
                        : null;
                    return { status: 'ALREADY_CLAIMED', coupon: coupon ?? null };
                }
                const coupon = await this.couponService.issueForProgram(txCtx, customerId, tpl, 'DAILY');
                await recordRepoTx.save(
                    new CouponDailyClaimRecord({
                        channelId: txCtx.channelId as number,
                        customerId,
                        templateId: Number(tpl.id),
                        claimDate: date,
                        couponId: coupon.id as number,
                    } as any),
                );
                Logger.info(`daily claim ok: customer=${customerId} template=${tpl.id} date=${date}`, loggerCtx);
                return { status: 'OK', coupon };
            });
        } catch (e: any) {
            if (String(e?.message ?? '').includes('UNIQUE') || String(e?.code ?? '') === '23505') {
                // 并发下唯一索引冲突 = 当天已领（R3 幂等）
                Logger.warn(`daily claim conflict for customer ${customerId}: ${e?.message ?? e}`, loggerCtx);
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
    async flashSaleActivity(ctx: RequestContext): Promise<FlashSaleActivityView | null> {
        const raw = await this.loadRawConfig(ctx, 'couponFlashSale');
        const cfg = parseCouponFlashSaleConfig(raw);
        if (!cfg) return null;
        const templates = await this.connection.getRepository(ctx, CouponTemplate).find({
            where: { id: In(cfg.templateIds) as any },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = resolveActiveFlashSale(raw, own, new Date(), ctx.languageCode);
        if (!view) return null;
        const customerId = await this.currentCustomerId(ctx);
        const myClaimed = new Map<number, number>();
        if (customerId) {
            const rows = await this.countFlashClaims(ctx, customerId, view.startsAt, view.endsAt, view.templates.map(t => Number(t.id)));
            for (const r of rows) myClaimed.set(r.templateId, r.cnt);
        }
        return {
            name: view.name,
            subtitle: view.subtitle,
            rules: view.rules,
            startsAt: view.startsAt,
            endsAt: view.endsAt,
            perUserLimit: view.perUserLimit,
            items: view.templates.map(t => ({
                template: t,
                soldOut: t.totalCount > 0 && t.claimedCount >= t.totalCount,
                myClaimed: myClaimed.get(Number(t.id)) ?? 0,
            })),
        };
    }

    /** 场次窗内 FLASH 发券计数（按模板分组） */
    private async countFlashClaims(
        ctx: RequestContext,
        customerId: number,
        startsAt: string,
        endsAt: string,
        templateIds: number[],
    ): Promise<Array<{ templateId: number; cnt: number }>> {
        if (!templateIds.length) return [];
        const rows = await this.connection
            .getRepository(ctx, CustomerCoupon)
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
    async claimFlash(ctx: RequestContext, templateId: number): Promise<FrfClaimResult> {
        const customerId = await this.currentCustomerId(ctx);
        if (!customerId) {
            return { status: 'NOT_LOGGED_IN', coupon: null };
        }
        await this.couponService.expireDueCoupons(ctx, customerId);
        const raw = await this.loadRawConfig(ctx, 'couponFlashSale');
        const cfg = parseCouponFlashSaleConfig(raw);
        if (!cfg) {
            return { status: 'INACTIVE', coupon: null };
        }
        // 窗口细分（B1）
        const ws = windowState(cfg.startsAt, cfg.endsAt, new Date());
        if (ws === 'PENDING') return { status: 'NOT_STARTED', coupon: null };
        if (ws === 'ENDED') return { status: 'ENDED', coupon: null };
        const templates = await this.connection.getRepository(ctx, CouponTemplate).find({
            where: { id: In(cfg.templateIds) as any },
            relations: { channels: true },
        });
        const own = templates.filter(t => this.isOwn(ctx, t));
        const view = resolveActiveFlashSale(raw, own, new Date(), ctx.languageCode);
        const tpl = view?.templates.find(t => Number(t.id) === Math.floor(Number(templateId)));
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
        const myCount = claimed[0]?.cnt ?? 0;
        if (myCount >= view.perUserLimit) {
            return { status: 'PER_USER_LIMIT', coupon: null };
        }
        // R2 原子限量：超发不可能；售罄稳定失败（B2）
        try {
            const coupon = await this.couponService.issueForProgram(ctx, customerId, tpl, 'FLASH');
            Logger.info(`flash claim ok: customer=${customerId} template=${tpl.id}`, loggerCtx);
            return { status: 'OK', coupon };
        } catch (e: any) {
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
    async payGiftOnOrderSettled(ctx: RequestContext, order: Order): Promise<void> {
        try {
            const raw = await this.loadRawConfig(ctx, 'couponPayGift');
            const cfg = parseCouponPayGiftConfig(raw);
            if (!cfg) return;
            const customerId = order.customerId as number | undefined;
            if (!customerId) return;
            // 实付门槛（分；C2）
            if (!payGiftEligible(cfg, Number(order.totalWithTax) || 0)) {
                Logger.info(
                    `pay gift skip: order ${order.id} total ${order.totalWithTax} below minAmount ${cfg.minAmount}`,
                    loggerCtx,
                );
                return;
            }
            const tpl = await this.connection
                .getRepository(ctx, CouponTemplate)
                .findOne({ where: { id: cfg.templateId as any }, relations: { channels: true } });
            if (!tpl || !this.isOwn(ctx, tpl)) {
                Logger.warn(`pay gift skip: template ${cfg.templateId} not usable on channel ${ctx.channelId}`, loggerCtx);
                return;
            }
            // 冷却防骚扰（R4/C3）：同模板 PAYGIFT cooldownDays 内已发过则跳过
            const since = new Date(Date.now() - cfg.cooldownDays * 86400_000);
            const recent = await this.connection
                .getRepository(ctx, CustomerCoupon)
                .createQueryBuilder('cc')
                .where('cc.customerId = :customerId', { customerId })
                .andWhere('cc.templateId = :templateId', { templateId: tpl.id as any })
                .andWhere("cc.issuedBy = 'PAYGIFT'")
                .andWhere('cc.createdAt >= :since', { since })
                .getCount();
            if (recent > 0) {
                Logger.info(
                    `pay gift skip (RECENTLY_GRANTED): customer=${customerId} template=${tpl.id} cooldown=${cfg.cooldownDays}d`,
                    loggerCtx,
                );
                return;
            }
            const blocked = await this.couponService.assertCustomerCanClaim(ctx, customerId, tpl);
            if (blocked) {
                Logger.info(`pay gift skip (${blocked}): customer=${customerId} template=${tpl.id}`, loggerCtx);
                return;
            }
            try {
                const coupon = await this.couponService.issueForProgram(ctx, customerId, tpl, 'PAYGIFT');
                Logger.info(
                    `pay gift issued: order=${order.id} customer=${customerId} coupon=${coupon.code}`,
                    loggerCtx,
                );
            } catch (e: any) {
                // 售罄（C5）等发放失败静默跳过
                Logger.warn(`pay gift issue failed for order ${order.id}: ${e?.message ?? e}`, loggerCtx);
            }
        } catch (e: any) {
            Logger.warn(`pay gift processing failed for order ${order.id}: ${e?.message ?? e}`, loggerCtx);
        }
    }
}
