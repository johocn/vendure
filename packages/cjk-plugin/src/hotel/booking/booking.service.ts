// 酒店预订单服务（P3 Task 10）：状态机流转 + 确认联动锁房。
// - 纯判定逻辑在 booking-logic.ts（可单测）；本服务只做 DB 编排
// - 确认口径（设计决策 #6）：订单状态 PartiallyPaid（支付计划首期付清）或 PaymentSettled（全额付清）
// - 事件接入（OrderEvent → handleOrderUpdated）在 Task 11 于 plugin.ts onInit 订阅
import { Injectable } from '@nestjs/common';
import {
    ID,
    Logger,
    Order,
    OrderModifier,
    OrderService,
    Payment,
    PaymentService,
    PaymentStateTransitionEvent,
    ProductVariant,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { In, LessThan, LessThanOrEqual } from 'typeorm';
import {
    AfterSalesRequest,
    AfterSalesStateTransitionEvent,
} from '@vendure/after-sales-plugin';
import type { AfterSalesService } from '@vendure/after-sales-plugin';

import { CancelPolicy } from '../hotel-config';
import { calcNightlyPricing, parseHotelRoomConfig } from '../hotel-nightly-pricing';
import { HotelInventoryService, HotelSoldOutError } from './hotel-inventory.service';
import { enumerateNights } from './hotel-inventory-logic';
import { HotelRatePlanService } from './rate-plan.service';
import {
    HotelBookingStatus,
    HOTEL_ORDER_PENDING_STATES,
    HOTEL_MAX_RESCHEDULES_V1,
    canCheckIn,
    computeCancelQuote,
    deriveCancelDeadline,
    evaluateRescheduleRules,
    generateBookingCode,
    hotelDatesOfLine,
    bookingTotalCent,
    toDateOnly,
    todayStr,
    type CancelQuote,
} from './booking-logic';
import { HotelBooking } from './booking.entity';

const loggerCtx = 'HotelBookingService';

/** 可取消（管理员强制取消）的状态白名单 */
const CANCELLABLE_STATUSES: HotelBookingStatus[] = ['pendingDeposit', 'confirmed'];

/** 补差支付 metadata 标记（PaymentStateTransitionEvent 路由用） */
const RESCHEDULE_PAYMENT_META_TYPE = 'hotelRescheduleSupplement';
/**
 * 改期退差/补差舍入退回的系统售后单 reason 前缀标记。
 * handleAfterSalesRefunded 凭此区分「取消退款」与「改期多退少补」：
 * 改期退款完成不得触发取消收口（否则会把新段锁房释放并把预订置 cancelled）。
 */
const RESCHEDULE_REFUND_REASON_PREFIX = '[hotel-reschedule-refund]';

export interface HotelBookingAdminFilter {
    status?: string;
    variantId?: ID;
    orderId?: ID;
    orderCode?: string;
}

/** 取消报价结果（shop/admin 共用；SDL 映射由 resolver 完成） */
export interface HotelCancelQuoteResult {
    booking: HotelBooking;
    quote: CancelQuote;
    /** 已结算实付快照（分） */
    paidCent: number;
    /** 首晚房费（全部房间合计，分） */
    firstNightFeeCent: number;
}

/** 改期逐晚可行性（remaining 已含本单旧锁；feasible=扣除旧锁后可住） */
export interface HotelRescheduleNight {
    date: string;
    /** 原始余量（null=不限房） */
    remaining: number | null;
    closed: boolean;
    feasible: boolean;
}

/** 改期报价结果 */
export interface HotelRescheduleQuoteResult {
    booking: HotelBooking;
    eligible: boolean;
    /** 拦截码：纯函数规则码或 soldOut */
    reason?: string;
    message?: string;
    oldCheckIn: string;
    oldCheckOut: string;
    newCheckIn: string;
    newCheckOut: string;
    nights: number;
    oldTotalCent: number;
    /** 规则/房态/配置不通过时为 null */
    newTotalCent: number | null;
    /** 新−旧（分）：正=补差，负=退差 */
    diffCent: number | null;
    refundCent: number | null;
    supplementCent: number | null;
    availability: HotelRescheduleNight[];
}

/** 改期 mutation 结果：applied=false 时为补差异步支付在途，需等支付 Settled 事件收口 */
export interface HotelRescheduleMutationResult {
    booking: HotelBooking;
    applied: boolean;
    paymentState: string | null;
    paymentId: number | null;
    supplementCent: number;
    /** 支付透传参数（如微信 payUrl/payType，原样来自 payment.metadata.public） */
    paymentPublic: Record<string, any> | null;
}

/** 待支付补差意向（reschedulePendingJson 持久化结构） */
interface ReschedulePendingJson {
    checkIn: string;
    checkOut: string;
    nights: number;
    expectedTotalCent: number;
    diffCent: number;
    paymentId: number;
    createdAt: string;
}

@Injectable()
export class HotelBookingService {
    /** after-sales 插件由 plugin.ts onInit 延迟注入（跨插件依赖，规避模块初始化顺序） */
    private afterSales: AfterSalesService | null = null;

    constructor(
        private conn: TransactionalConnection,
        private inventory: HotelInventoryService,
        private ratePlans: HotelRatePlanService,
        private orderService: OrderService,
        private orderModifier: OrderModifier,
        private paymentService: PaymentService,
    ) {}

    setAfterSalesService(svc: AfterSalesService) {
        this.afterSales = svc;
    }

    private repo(ctx: RequestContext) {
        return this.conn.getRepository(ctx, HotelBooking);
    }

    // ===== 查询 =====

    async listByOrder(ctx: RequestContext, orderId: ID): Promise<HotelBooking[]> {
        return this.repo(ctx).find({ where: { orderId: Number(orderId) }, order: { id: 'ASC' } });
    }

    /** 订单行当前预订单（最新一条；同一行重建场景取 id 最大） */
    async getByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<HotelBooking | null> {
        return this.repo(ctx).findOne({ where: { orderLineId: Number(orderLineId) }, order: { id: 'DESC' } });
    }

    async findByCode(ctx: RequestContext, code: string): Promise<HotelBooking | null> {
        const c = String(code ?? '').trim();
        if (!/^\d{8}$/.test(c)) return null;
        return this.repo(ctx).findOne({ where: { bookingCode: c } });
    }

    /** 商家端简版列表（Task 13 预订管理页数据源；id DESC 尾页语义，上限 200） */
    async listForAdmin(
        ctx: RequestContext,
        filter: HotelBookingAdminFilter = {},
        take = 200,
    ): Promise<HotelBooking[]> {
        const where: any = {};
        if (filter.status) where.status = filter.status;
        if (filter.variantId != null) where.productVariantId = Number(filter.variantId);
        if (filter.orderId != null) where.orderId = Number(filter.orderId);
        if (filter.orderCode) where.orderCode = filter.orderCode;
        // 租户隔离：channelToken 存 booking 时为创建渠道；admin 会话经 vendure-token 绑定渠道后只看本渠道
        if (ctx.channel?.token) where.channelToken = ctx.channel.token;
        const rows = await this.repo(ctx).find({ where, order: { id: 'DESC' }, take });
        await this.enrichVariantNames(ctx, rows);
        return rows;
    }

    /** 批量补房型名（非持久化字段，仅 admin 列表展示；按 ctx 语言取 translation） */
    private async enrichVariantNames(ctx: RequestContext, rows: HotelBooking[]): Promise<void> {
        const ids = [...new Set(rows.map(r => Number(r.productVariantId)))].filter(n => Number.isFinite(n));
        if (!ids.length) return;
        const lang = String(ctx.languageCode ?? '');
        const variants = await this.conn.getRepository(ctx, ProductVariant).find({
            where: { id: In(ids) },
            relations: ['translations'],
        });
        const names = new Map<number, string>();
        for (const v of variants) {
            const trs = ((v as any).translations ?? []) as any[];
            const hit = trs.find(t => String(t.languageCode) === lang) ?? trs[0];
            names.set(Number(v.id), String(hit?.name ?? '').trim());
        }
        for (const r of rows) {
            r.variantName = names.get(Number(r.productVariantId)) || null;
        }
    }

    /** C 端「我的预订」：按顾客名下订单 id 集合过滤（归属隔离在 resolver 层做），可选状态过滤 */
    async listForCustomer(ctx: RequestContext, orderIds: number[], status?: string): Promise<HotelBooking[]> {
        if (!orderIds.length) return [];
        const where: any = { orderId: In(orderIds) };
        if (status) where.status = status;
        return this.repo(ctx).find({ where, order: { id: 'DESC' }, take: 200 });
    }

    // ===== 状态机：建单（pendingDeposit） =====

    /**
     * 幂等创建 pending 预订单（per 酒店订单行）：
     * - 行已有非 cancelled booking → 跳过；若仍为 pendingDeposit 则同步可能变化的日期/数量/金额
     * - 行仅有 cancelled 旧 booking（整单取消后重走支付等边缘）→ 重建新 pending 行
     */
    async ensurePendingBookings(ctx: RequestContext, order: Order): Promise<HotelBooking[]> {
        const created: HotelBooking[] = [];
        for (const line of order.lines ?? []) {
            const cf = (line as any).customFields ?? {};
            const dates = hotelDatesOfLine(cf);
            if (!dates) continue; // 非酒店行零侵入
            const variantId = Number((line.productVariant as any)?.id ?? (line as any).productVariantId);
            if (!Number.isFinite(variantId) || variantId <= 0) continue;

            const existing = await this.repo(ctx).findOne({
                where: { orderLineId: Number(line.id) },
                order: { id: 'DESC' },
            });
            if (existing && existing.status !== 'cancelled') {
                if (existing.status === 'pendingDeposit') {
                    await this.syncPendingWithLine(ctx, existing, order, line, dates, variantId);
                }
                continue;
            }
            // 已取消且关联退款售后单（Task 14）：行随退款链路终结，即使退款引发订单状态事件重放，
            // 也绝不重建/重确认幻影预订（无售后单的旧取消仍保留「取消后重走支付重建」边缘能力）
            if (existing && existing.afterSalesRequestId != null) continue;

            const guest = this.guestOf(order, cf);
            const booking = await this.repo(ctx).save(
                new HotelBooking({
                    bookingCode: null,
                    orderId: Number(order.id),
                    orderLineId: Number(line.id),
                    orderCode: order.code ?? null,
                    channelToken: ctx.channel?.token ?? null,
                    productVariantId: variantId,
                    checkIn: dates.checkIn,
                    checkOut: dates.checkOut,
                    nights: enumerateNights(dates.checkIn, dates.checkOut).length,
                    roomCount: line.quantity,
                    status: 'pendingDeposit',
                    ratePlanCode: (cf.ratePlanCode || null) as string | null,
                    totalCent: bookingTotalCent(line as any),
                    guestName: guest.name,
                    guestPhone: guest.phone,
                }),
            );
            created.push(booking);
        }
        return created;
    }

    /** pending 阶段与订单行保持一致（加购后调整日期/数量/方案的场景） */
    private async syncPendingWithLine(
        ctx: RequestContext,
        booking: HotelBooking,
        order: Order,
        line: Order['lines'][number],
        dates: { checkIn: string; checkOut: string },
        variantId: number,
    ): Promise<void> {
        const cf = (line as any).customFields ?? {};
        const nights = enumerateNights(dates.checkIn, dates.checkOut).length;
        const patch: Partial<HotelBooking> = {};
        if (booking.checkIn !== dates.checkIn) patch.checkIn = dates.checkIn;
        if (booking.checkOut !== dates.checkOut) patch.checkOut = dates.checkOut;
        if (booking.nights !== nights) patch.nights = nights;
        if (booking.roomCount !== line.quantity) patch.roomCount = line.quantity;
        if (booking.productVariantId !== variantId) patch.productVariantId = variantId;
        const planCode = (cf.ratePlanCode || null) as string | null;
        if (booking.ratePlanCode !== planCode) patch.ratePlanCode = planCode;
        const total = bookingTotalCent(line as any);
        if (booking.totalCent !== total) patch.totalCent = total;
        const guest = this.guestOf(order, cf);
        if (!booking.guestName && guest.name) patch.guestName = guest.name;
        if (!booking.guestPhone && guest.phone) patch.guestPhone = guest.phone;
        if (Object.keys(patch).length) {
            await this.repo(ctx).update(booking.id, patch as any);
        }
    }

    /** 客人信息：行 customFields（预留）→ 订单客户 → 收货地址 */
    private guestOf(order: Order, cf: Record<string, any>): { name: string | null; phone: string | null } {
        const name =
            (typeof cf.hotelGuestName === 'string' && cf.hotelGuestName.trim()) ||
            [order.customer?.lastName, order.customer?.firstName].filter(Boolean).join(' ').trim() ||
            (order.shippingAddress as any)?.fullName ||
            null;
        const phone =
            (typeof cf.hotelGuestPhone === 'string' && cf.hotelGuestPhone.trim()) ||
            (order.shippingAddress as any)?.phoneNumber ||
            order.customer?.phoneNumber ||
            null;
        return { name: name || null, phone: phone || null };
    }

    // ===== 状态机：确认（confirmed） =====

    /**
     * 幂等确认订单下全部 pending 预订单：生成入住码 + 固化取消截止点 + hold→booked。
     * 状态守卫在调用方（handleOrderUpdated 按订单状态判断）。
     */
    async confirmPendingForOrder(ctx: RequestContext, orderId: ID): Promise<HotelBooking[]> {
        const pending = await this.repo(ctx).find({ where: { orderId: Number(orderId), status: 'pendingDeposit' } });
        const confirmed: HotelBooking[] = [];
        for (const b of pending) {
            b.bookingCode = await this.allocateCode(ctx);
            // deriveDeadline 可能为 null（无政策/nonRefundable）——列已是 null，undefined = 保持不变
            b.cancelDeadlineAt = (await this.deriveDeadline(ctx, b)) ?? undefined;
            b.confirmedAt = new Date();
            b.status = 'confirmed';
            const saved = await this.repo(ctx).save(b);
            await this.inventory.confirmLocks(ctx, saved.orderId, saved.productVariantId, {
                orderLineId: saved.orderLineId,
                bookingId: saved.id,
            });
            confirmed.push(saved);
            Logger.info(
                `Booking ${saved.id} confirmed (order ${saved.orderId}, code ${saved.bookingCode})`,
                loggerCtx,
            );
        }
        return confirmed;
    }

    /** 8 位入住码分配：随机 + 查重重试，5 次未命中回退时间戳后 8 位（唯一索引兜底） */
    private async allocateCode(ctx: RequestContext, attempts = 5): Promise<string> {
        for (let i = 0; i < attempts; i++) {
            const code = generateBookingCode();
            const dup = await this.repo(ctx).findOne({ where: { bookingCode: code } });
            if (!dup) return code;
        }
        return String(Date.now() % 100_000_000).padStart(8, '0');
    }

    /**
     * 房型计价上下文：variant + 解析后的 hotelRoomConfig + 有效取消政策 + 房价方案调整。
     * 有效取消政策：方案级 cancelPolicyOverride 优先（坏 JSON 回退房型级），再回退房型 cancelPolicy。
     */
    private async resolveRoomContext(
        ctx: RequestContext,
        b: HotelBooking,
    ): Promise<{
        variant: ProductVariant | null;
        cfg: ReturnType<typeof parseHotelRoomConfig>;
        policy: CancelPolicy | null;
        planAdjust: { adjustType: string; adjustValue: number } | null;
    }> {
        const variant =
            (await this.conn
                .getRepository(ctx, ProductVariant)
                .findOne({ where: { id: Number(b.productVariantId) } })) ?? null;
        const cfg = parseHotelRoomConfig((variant?.customFields as any)?.hotelRoomConfig);
        let policy: CancelPolicy | null | undefined = cfg?.cancelPolicy ?? null;
        let planAdjust: { adjustType: string; adjustValue: number } | null = null;
        if (b.ratePlanCode) {
            const plans = await this.ratePlans.findByCodes(ctx, b.productVariantId, [b.ratePlanCode]);
            const plan = plans[0] as any;
            if (plan) {
                planAdjust = { adjustType: String(plan.adjustType ?? ''), adjustValue: Number(plan.adjustValue ?? 0) };
            }
            const raw = plan?.cancelPolicyOverride as string | null | undefined;
            if (raw) {
                try {
                    policy = JSON.parse(raw) as CancelPolicy;
                } catch {
                    policy = cfg?.cancelPolicy ?? null; // 坏 JSON 回退房型级政策
                }
            }
        }
        return { variant, cfg, policy: policy ?? null, planAdjust };
    }

    /** 有效取消政策解析（Task 14；语义保留，实现转调 resolveRoomContext） */
    private async resolvePolicy(
        ctx: RequestContext,
        b: HotelBooking,
    ): Promise<{ policy: CancelPolicy | null; planAdjust: { adjustType: string; adjustValue: number } | null }> {
        const { policy, planAdjust } = await this.resolveRoomContext(ctx, b);
        return { policy, planAdjust };
    }

    /** 取消截止点固化：checkInTime 取房型配置（缺省 00:00） */
    private async deriveDeadline(ctx: RequestContext, b: HotelBooking): Promise<Date | null> {
        const { cfg, policy } = await this.resolveRoomContext(ctx, b);
        return deriveCancelDeadline(policy, b.checkIn, cfg?.checkInTime);
    }

    // ===== 事件入口（Task 11 于 plugin.ts 订阅 OrderEvent/OrderStateTransitionEvent 调用） =====

    /**
     * OrderStateTransitionEvent 入口：事件携带的 order 不保证加载 lines/customer，
     * 按 id 重取完整订单后复用 handleOrderUpdated（幂等，双路触发无副作用）。
     */
    async handleOrderTransition(ctx: RequestContext, orderId: ID): Promise<void> {
        const order = await this.conn.getRepository(ctx, Order).findOne({
            where: { id: Number(orderId) as any },
            relations: ['lines', 'customer'],
        });
        if (!order) return;
        await this.handleOrderUpdated(ctx, order);
    }

    /**
     * 订单更新 reconcile：
     * - 无酒店行 / 状态不在可处理集合 → no-op
     * - PENDING_STATES → ensure 幂等建单
     * - PartiallyPaid（首期付清）/ PaymentSettled（全清）→ confirm
     */
    async handleOrderUpdated(ctx: RequestContext, order: Order): Promise<void> {
        const lines = order.lines ?? [];
        if (lines.length === 0) return;
        if (!HOTEL_ORDER_PENDING_STATES.includes(order.state as any)) return;
        const hasHotel = lines.some(l => !!hotelDatesOfLine((l as any).customFields));
        if (!hasHotel) return;

        try {
            await this.ensurePendingBookings(ctx, order);
            const state = order.state as string;
            if (state === 'PartiallyPaid' || state === 'PaymentSettled') {
                await this.confirmPendingForOrder(ctx, order.id);
            }
        } catch (e: any) {
            // 事件链路不阻断主流程，留日志排查
            Logger.error(`handleOrderUpdated order ${order.code ?? order.id} failed: ${e?.message}`, loggerCtx);
        }
    }

    // ===== 核销 / 完成 / 取消 =====

    /** 到店核销：凭 id 或 8 位入住码；仅 confirmed 且当日 ∈ [checkIn, checkOut) */
    async checkIn(ctx: RequestContext, input: { id?: ID; code?: string }): Promise<HotelBooking> {
        let booking: HotelBooking | null = null;
        if (input.code != null && String(input.code).trim() !== '') {
            booking = await this.findByCode(ctx, String(input.code));
            if (!booking) throw new Error('入住码不存在');
        } else if (input.id != null) {
            booking = await this.repo(ctx).findOne({ where: { id: Number(input.id) } });
        }
        if (!booking) throw new Error('预订单不存在');
        const today = todayStr();
        if (!canCheckIn(booking.status, booking.checkIn, booking.checkOut, today)) {
            throw new Error(`当前不可入住（状态 ${booking.status}，入住日 ${booking.checkIn}）`);
        }
        booking.status = 'checkedIn';
        booking.checkedInAt = new Date();
        return this.repo(ctx).save(booking);
    }

    /** 手动完成离店：仅 checkedIn 可完成（日常定时任务兜底自动完成） */
    async complete(ctx: RequestContext, id: ID): Promise<HotelBooking> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new Error('预订单不存在');
        if (booking.status !== 'checkedIn') throw new Error(`当前状态 ${booking.status} 不可完成离店`);
        booking.status = 'completed';
        booking.completedAt = new Date();
        return this.repo(ctx).save(booking);
    }

    // ===== P4 Task 14：取消报价 / 取消退款 =====

    /**
     * 取消报价（design §8）：解析有效政策 + 已结算实付 + 首晚房费，交纯函数 computeCancelQuote。
     * 可取消状态白名单之外（已入住/已完成/noShow/已取消）一律拒绝。
     */
    async quoteCancel(ctx: RequestContext, id: ID, now?: Date): Promise<HotelCancelQuoteResult> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new Error('预订单不存在');
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            throw new Error(`当前状态 ${booking.status} 不可取消`);
        }
        const { policy, planAdjust } = await this.resolvePolicy(ctx, booking);
        const paidCent = await this.settledPaidCent(ctx, booking.orderId);
        const firstNightFeeCent = await this.firstNightFeeCent(ctx, booking, policy, planAdjust);
        const quote = computeCancelQuote({
            status: booking.status,
            policy,
            deadline: booking.cancelDeadlineAt ?? null,
            now,
            totalCent: booking.totalCent,
            paidCent,
            firstNightFeeCent,
        });
        return { booking, quote, paidCent, firstNightFeeCent };
    }

    /** 订单已结算（Settled）支付合计（分）；仅 Settled 可走 refundOrder 退款，Authorized 不计 */
    private async settledPaidCent(ctx: RequestContext, orderId: number): Promise<number> {
        const order = await this.conn.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['payments'],
        });
        const payments = ((order as any)?.payments ?? []) as Array<{ state: string; amount: number }>;
        return payments
            .filter(p => p.state === 'Settled')
            .reduce((sum, p) => sum + Math.round(Number(p.amount) || 0), 0);
    }

    /**
     * 首晚房费（全部房间合计，分）：服务端用房型配置+方案重算（hotelNightly 不落库）；
     * 配置缺失/重算失败时兜底 ceil(成交总额/晚数)，保证扣款口径非 0。
     */
    private async firstNightFeeCent(
        ctx: RequestContext,
        b: HotelBooking,
        policy: CancelPolicy | null,
        planAdjust: { adjustType: string; adjustValue: number } | null,
    ): Promise<number> {
        if (policy?.partial === 'full') return b.totalCent;
        try {
            const variant = await this.conn
                .getRepository(ctx, ProductVariant)
                .findOne({ where: { id: Number(b.productVariantId) } });
            const cfg = parseHotelRoomConfig((variant?.customFields as any)?.hotelRoomConfig);
            const pricing = calcNightlyPricing(
                cfg,
                b.checkIn,
                b.checkOut,
                planAdjust?.adjustType ? (planAdjust as any) : null,
            );
            const perRoom = pricing?.nights?.[0]?.priceCent;
            if (typeof perRoom === 'number' && perRoom > 0) return perRoom * Math.max(1, b.roomCount);
        } catch (e: any) {
            Logger.warn(`firstNightFeeCent booking ${b.id} recompute failed: ${e?.message}`, loggerCtx);
        }
        return Math.ceil(b.totalCent / Math.max(1, b.nights));
    }

    /**
     * 顾客自助取消（归属隔离在 resolver 层）：
     * - unpaid（未付/仅授权）/ forfeit（扣全款不退）→ 立即置 cancelled + 释放锁房，无售后单
     * - free（免费窗口内）→ 建 refund_only 售后单并自动审批退款；退款成功后立即收口；
     *   RefundFailed 不取消、不释放，售后单留痕可重试
     * - partial（逾时扣首晚退余款）→ 建 Pending 售后单等待商家审批，booking 保持 confirmed 与锁房；
     *   审批 Refunded 后由 handleAfterSalesRefunded 收口
     * - blocked（未配置政策）→ 拒绝，引导联系酒店
     */
    async cancelByCustomer(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking> {
        const { booking, quote, paidCent } = await this.quoteCancel(ctx, id);
        await this.assertNoActiveAfterSales(ctx, booking);
        if (!quote.cancellable) {
            throw new Error('该订单暂不支持线上自助取消，请联系酒店/客服处理');
        }
        const userReason = (reason ?? '').trim();
        const baseReason = `预订取消 ${booking.bookingCode ?? booking.id}${userReason ? `｜${userReason}` : ''}`;

        if (quote.mode === 'unpaid' || quote.mode === 'forfeit') {
            return this.finalizeCancel(ctx, booking, {
                feeCent: quote.mode === 'forfeit' ? paidCent : 0,
                reason: baseReason,
            });
        }

        if (!this.afterSales) {
            // 售后插件缺失：免费/部分退款无法走钱，禁止自助取消（防止漏退款）
            Logger.error(`cancelByCustomer booking ${booking.id}: AfterSalesService unavailable`, loggerCtx);
            throw new Error('退款服务暂不可用，请联系客服取消');
        }

        if (quote.mode === 'free') {
            const req = await this.afterSales.createSystemRequest(ctx, {
                orderId: booking.orderId,
                orderLineId: booking.orderLineId,
                type: 'refund_only',
                reason: `${baseReason}｜免费窗口内全额退`,
                refundAmount: quote.refundCent,
            });
            const approved = await this.afterSales.approveRequest(ctx, req.id);
            if (approved.state !== 'Refunded') {
                throw new Error(
                    `退款未成功（售后单 ${req.id} 状态 ${approved.state}），预订保留，请稍后重试或联系客服`,
                );
            }
            return this.finalizeCancel(ctx, booking, {
                feeCent: 0,
                reason: baseReason,
                afterSalesRequestId: Number(req.id),
            });
        }

        // partial：逾时扣首晚，余款售后单待商家审批
        const req = await this.afterSales.createSystemRequest(ctx, {
            orderId: booking.orderId,
            orderLineId: booking.orderLineId,
            type: 'refund_only',
            reason: `${baseReason}｜逾时扣首晚 ¥${(quote.feeCent / 100).toFixed(2)}，申请退余款`,
            description: `取消扣款 ${quote.feeCent} 分；应退 ${quote.refundCent} 分；已付 ${paidCent} 分`,
            refundAmount: quote.refundCent,
        });
        booking.afterSalesRequestId = Number(req.id);
        booking.cancelReason = baseReason;
        const saved = await this.repo(ctx).save(booking);
        Logger.info(
            `Booking ${saved.id} cancel requested, after-sales ${req.id} pending approval (fee ${quote.feeCent})`,
            loggerCtx,
        );
        return saved;
    }

    /**
     * 管理员强制取消（升级）：
     * - 已有售后单在途 → 拒绝（防止双退；退款完成事件会自动收口）
     * - 有已结算款 → 建售后单全额退款并自动审批，Refunded 后才置 cancelled + 释放锁房
     * - 无结算款 / 售后插件缺失（仅遗留环境）→ 直接取消释放
     */
    async forceCancel(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new Error('预订单不存在');
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            throw new Error(`当前状态 ${booking.status} 不可取消`);
        }
        await this.assertNoActiveAfterSales(ctx, booking);
        const adminReason = `商家强制取消 ${booking.bookingCode ?? booking.id}${(reason ?? '').trim() ? `｜${(reason ?? '').trim()}` : ''}`;
        const paidCent = await this.settledPaidCent(ctx, booking.orderId);
        if (paidCent <= 0 || !this.afterSales) {
            if (paidCent > 0) {
                Logger.warn(
                    `forceCancel booking ${booking.id}: AfterSalesService unavailable, cancelling without refund`,
                    loggerCtx,
                );
            }
            return this.finalizeCancel(ctx, booking, { feeCent: 0, reason: adminReason });
        }
        const req = await this.afterSales.createSystemRequest(ctx, {
            orderId: booking.orderId,
            orderLineId: booking.orderLineId,
            type: 'refund_only',
            reason: `${adminReason}｜全额退款`,
            refundAmount: paidCent,
        });
        const approved = await this.afterSales.approveRequest(ctx, req.id);
        if (approved.state !== 'Refunded') {
            throw new Error(`退款未成功（售后单 ${req.id} 状态 ${approved.state}），预订保留`);
        }
        return this.finalizeCancel(ctx, booking, {
            feeCent: 0,
            reason: adminReason,
            afterSalesRequestId: Number(req.id),
        });
    }

    /**
     * 售后状态事件收口（plugin.ts 订阅 AfterSalesStateTransitionEvent）：
     * 仅 Refunded 触发；按 orderLineId 反查在途预订，置 cancelled + 释放锁房。
     * 扣款快照 = 已付 − 实际退款；幂等（已取消/noShow/已入住均 no-op）。
     */
    async handleAfterSalesRefunded(event: AfterSalesStateTransitionEvent): Promise<void> {
        if (event.toState !== 'Refunded') return;
        const ctx = event.ctx;
        try {
            const req = await this.conn.getRepository(ctx, AfterSalesRequest).findOne({
                where: { id: Number(event.requestId) as any },
            });
            if (!req || req.orderLineId == null) return;
            // 改期多退少补产生的系统退款单：不触发取消收口（预订仍为 confirmed，锁房已在新段）
            if (typeof req.reason === 'string' && req.reason.startsWith(RESCHEDULE_REFUND_REASON_PREFIX)) {
                return;
            }
            // 精确按售后关联定位发起取消的预订（退款引发的订单事件可能已产生新的同行动态，
            // 不能简单取 orderLine 最新一条）；无关联的历史数据回退最新一条兜底
            let booking = await this.repo(ctx).findOne({
                where: { afterSalesRequestId: Number(req.id) },
                order: { id: 'DESC' },
            });
            if (!booking) {
                booking = await this.repo(ctx).findOne({
                    where: { orderLineId: req.orderLineId },
                    order: { id: 'DESC' },
                });
            }
            if (!booking || !CANCELLABLE_STATUSES.includes(booking.status)) return;
            const paidCent = await this.settledPaidCent(ctx, booking.orderId);
            const actualRefund =
                req.actualRefundAmount != null
                    ? Math.max(0, Math.round(req.actualRefundAmount))
                    : Math.max(0, Math.round(req.refundAmount || 0));
            const feeCent = Math.max(0, paidCent - actualRefund);
            await this.finalizeCancel(ctx, booking, {
                feeCent,
                reason: booking.cancelReason ?? `售后退款完成自动取消（售后单 ${req.id}）`,
                afterSalesRequestId: Number(req.id),
            });
        } catch (e: any) {
            Logger.error(
                `handleAfterSalesRefunded request ${event.requestId} failed: ${e?.message}`,
                loggerCtx,
            );
        }
    }

    /**
     * 售后单在途守卫：关联单处于 Pending/Approved/Received/RefundFailed 等活动态 → 阻断（防双退）；
     * Rejected/Closed → 视为已终结，清空关联放行（可重新发起）；Refunded 理论上 booking 已收口，亦阻断。
     */
    private async assertNoActiveAfterSales(ctx: RequestContext, booking: HotelBooking): Promise<void> {
        if (booking.afterSalesRequestId == null) return;
        const req = await this.conn.getRepository(ctx, AfterSalesRequest).findOne({
            where: { id: booking.afterSalesRequestId as any },
        });
        const state = String(req?.state ?? '');
        if (state === 'Rejected' || state === 'Closed') {
            booking.afterSalesRequestId = null;
            await this.repo(ctx).update(booking.id, { afterSalesRequestId: null } as any);
            return;
        }
        throw new Error(
            `该预订已有退款售后单 ${booking.afterSalesRequestId}${state ? `（${state}）` : ''}处理中，请在售后管理中完成`,
        );
    }

    /** 取消收口：置 cancelled + 扣款快照 + 释放该行全部 lock（幂等） */
    private async finalizeCancel(
        ctx: RequestContext,
        booking: HotelBooking,
        opts: { feeCent: number; reason: string; afterSalesRequestId?: number },
    ): Promise<HotelBooking> {
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = opts.reason;
        booking.cancelFeeCent = Math.max(0, Math.round(opts.feeCent));
        if (opts.afterSalesRequestId != null) booking.afterSalesRequestId = opts.afterSalesRequestId;
        const saved = await this.repo(ctx).save(booking);
        await this.inventory.releaseLocksByOrderLine(ctx, saved.orderLineId);
        Logger.info(
            `Booking ${saved.id} cancelled (fee ${saved.cancelFeeCent}, after-sales ${saved.afterSalesRequestId ?? '-'})`,
            loggerCtx,
        );
        return saved;
    }

    // ===== 日常定时流转 =====

    /**
     * 离店日自动完成 / 过离店日未入住 noShow：
     * - checkedIn 且 today >= checkOut → completed
     * - confirmed 且 today > checkOut → noShow（不动锁：过去晚 booked 锁留审计，不影响未来售卖）
     */
    async runDailyTransitions(ctx: RequestContext, now?: Date): Promise<{ completed: number; noShow: number }> {
        const today = todayStr(now);
        const done = await this.repo(ctx)
            .update(
                { status: 'checkedIn' as any, checkOut: LessThanOrEqual(today) } as any,
                { status: 'completed', completedAt: new Date() } as any,
            );
        const nos = await this.repo(ctx)
            .update(
                { status: 'confirmed' as any, checkOut: LessThan(today) } as any,
                { status: 'noShow' } as any,
            );
        return { completed: done.affected ?? 0, noShow: nos.affected ?? 0 };
    }

    // ===== P4 Task 15：在线改期（报价 / 提交 / 补差支付收口） =====

    /**
     * 改期报价（不落库）：
     * - 规则（confirmed + V1 限改 1 次 + advanceDays/min/maxNights）不通过 → eligible=false + reason
     * - 房态：逐晚把「本单旧段内自身 booked 锁」加回余量后判定 feasible
     * - 价格：与 HotelOrderItemPriceCalculationStrategy 同口径（calcNightlyPricing.stayTotalCent，
     *   quantity=间数时策略除间数再乘回，行小计≈住宿总价）；最终以提交时重算订单行为准
     */
    async quoteReschedule(
        ctx: RequestContext,
        id: ID,
        dto: { checkIn: string; checkOut: string },
        now?: Date,
    ): Promise<HotelRescheduleQuoteResult> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new UserInputError('预订单不存在');
        const newCheckIn = toDateOnly(dto.checkIn) ?? '';
        const newCheckOut = toDateOnly(dto.checkOut) ?? '';
        const base: HotelRescheduleQuoteResult = {
            booking,
            eligible: false,
            oldCheckIn: booking.checkIn,
            oldCheckOut: booking.checkOut,
            newCheckIn,
            newCheckOut,
            nights: 0,
            oldTotalCent: booking.totalCent,
            newTotalCent: null,
            diffCent: null,
            refundCent: null,
            supplementCent: null,
            availability: [],
        };
        const { cfg, planAdjust } = await this.resolveRoomContext(ctx, booking);
        const rule = evaluateRescheduleRules({
            status: booking.status,
            rescheduleCount: booking.rescheduleCount ?? 0,
            oldCheckIn: booking.checkIn,
            oldCheckOut: booking.checkOut,
            newCheckIn,
            newCheckOut,
            advanceDays: cfg?.advanceDays,
            minNights: cfg?.minNights,
            maxNights: cfg?.maxNights,
            now,
        });
        if (!rule.ok) {
            return { ...base, reason: rule.reason, message: rule.message };
        }

        const availability = await this.rescheduleAvailability(ctx, booking, newCheckIn, newCheckOut);
        const sold = availability.find(a => !a.feasible);
        const pricing = calcNightlyPricing(
            cfg,
            newCheckIn,
            newCheckOut,
            planAdjust?.adjustType ? (planAdjust as any) : null,
        );
        const newTotalCent = pricing ? Math.round(pricing.stayTotalCent) : null;
        const diffCent = newTotalCent == null ? null : newTotalCent - booking.totalCent;
        return {
            ...base,
            nights: rule.nights,
            eligible: !sold && newTotalCent != null,
            reason: sold ? 'soldOut' : newTotalCent == null ? 'pricingError' : undefined,
            message: sold
                ? sold.closed
                    ? `日期 ${sold.date} 已关房，无法改期`
                    : `日期 ${sold.date} 房量不足，无法改期`
                : newTotalCent == null
                    ? '房价配置异常，暂时无法改期'
                    : undefined,
            newTotalCent,
            diffCent,
            refundCent: diffCent == null ? null : Math.max(0, -diffCent),
            supplementCent: diffCent == null ? null : Math.max(0, diffCent),
            availability,
        };
    }

    /** 逐晚可行性：旧段内的晚把本单 roomCount 间自身锁加回（移动锁房的净占用口径） */
    private async rescheduleAvailability(
        ctx: RequestContext,
        booking: HotelBooking,
        newCheckIn: string,
        newCheckOut: string,
    ): Promise<HotelRescheduleNight[]> {
        const rows = await this.inventory.getAvailability(ctx, booking.productVariantId, newCheckIn, newCheckOut);
        return rows.map(r => {
            const inOldSegment = r.date >= booking.checkIn && r.date < booking.checkOut;
            const ownLocks = inOldSegment ? Math.max(1, booking.roomCount) : 0;
            const effectiveRemaining = r.remaining == null ? null : r.remaining + ownLocks;
            return {
                date: r.date,
                remaining: r.remaining,
                closed: r.closed,
                feasible: !r.closed && (effectiveRemaining == null || effectiveRemaining >= Math.max(1, booking.roomCount)),
            };
        });
    }

    /**
     * 顾客提交改期（归属隔离在 resolver 层；须在事务内调用）：
     * - 等价/退差：移动锁房 → 订单行重定价 → 退差走售后系统单自动退款 → 预订改期完成
     * - 补差：先建补差 Payment（不动订单行/锁/价）：
     *   · 同步 Settled（钱包/模拟支付）→ Payment 事件内同步完成改期
     *   · 异步 Authorized（微信/COD）→ 落 reschedulePendingJson，等 Settled 事件收口
     */
    async rescheduleByCustomer(
        ctx: RequestContext,
        id: ID,
        dto: { checkIn: string; checkOut: string; paymentMethod?: string | null },
    ): Promise<HotelRescheduleMutationResult> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new UserInputError('预订单不存在');
        this.assertReschedulable(booking);
        await this.assertNoActiveAfterSales(ctx, booking);
        const target = await this.buildRescheduleTarget(ctx, booking, dto);

        if (target.diffCent <= 0) {
            const saved = await this.applyReschedule(ctx, booking, target, { payment: null });
            return {
                booking: saved,
                applied: true,
                paymentState: null,
                paymentId: null,
                supplementCent: 0,
                paymentPublic: null,
            };
        }

        const method = String(dto.paymentMethod ?? '').trim();
        if (!method) {
            throw new UserInputError(
                `改期后需补差价 ¥${(target.diffCent / 100).toFixed(2)}，请选择支付方式后提交`,
            );
        }
        const order = await this.orderService.findOne(ctx, booking.orderId, ['payments']);
        if (!order) throw new UserInputError('订单不存在');
        if (order.state !== 'PaymentSettled') {
            // PartiallyPaid（首付未付清）改期涉及定金比例重算，V1 不支持，引导客服
            throw new UserInputError('仅已全额支付的预订支持线上改期补差，请联系客服处理');
        }
        const payment = await this.paymentService.createPayment(ctx, order, target.diffCent, method, {
            type: RESCHEDULE_PAYMENT_META_TYPE,
            rescheduleBookingId: Number(booking.id),
            rescheduleCheckIn: target.checkIn,
            rescheduleCheckOut: target.checkOut,
            rescheduleNights: target.nights,
            // Shop API Payment.metadata 只透出 public 子字段（与微信支付 handler 同约定）
            public: {
                type: RESCHEDULE_PAYMENT_META_TYPE,
                amountCent: target.diffCent,
                bookingId: Number(booking.id),
                newCheckIn: target.checkIn,
                newCheckOut: target.checkOut,
            },
        });
        if (payment instanceof Error || (payment as any).errorCode) {
            throw new UserInputError(
                `补差支付发起失败：${(payment as any).eligibilityCheckerMessage ?? (payment as any).message ?? '支付方式不可用'}`,
            );
        }
        const pay = payment as Payment;
        const paymentPublic = ((pay.metadata as any)?.public ?? null) as Record<string, any> | null;
        if (pay.state === 'Settled') {
            // createPayment 事务内已同步派发 Settled 事件 → handleReschedulePayment 已完成改期，此处只回读
            const done = await this.repo(ctx).findOne({ where: { id: Number(booking.id) } });
            return {
                booking: done ?? booking,
                applied: true,
                paymentState: 'Settled',
                paymentId: Number(pay.id),
                supplementCent: target.diffCent,
                paymentPublic,
            };
        }

        // 异步支付：登记待支付意向（不动订单/锁房/价格；支付完成前预订一切照旧）
        const pending: ReschedulePendingJson = {
            checkIn: target.checkIn,
            checkOut: target.checkOut,
            nights: target.nights,
            expectedTotalCent: target.expectedTotalCent,
            diffCent: target.diffCent,
            paymentId: Number(pay.id),
            createdAt: new Date().toISOString(),
        };
        booking.reschedulePendingJson = JSON.stringify(pending);
        const saved = await this.repo(ctx).save(booking);
        Logger.info(
            `Booking ${saved.id} reschedule supplement pending: payment ${pay.id} (${pay.state}), ${saved.checkIn}→${target.checkIn}`,
            loggerCtx,
        );
        return {
            booking: saved,
            applied: false,
            paymentState: pay.state,
            paymentId: Number(pay.id),
            supplementCent: target.diffCent,
            paymentPublic,
        };
    }

    /** 顾客放弃补差：支付未结算则取消 Payment 并清空在途意向（Settled 会自动完成改期，拒绝取消） */
    async cancelRescheduleSupplement(ctx: RequestContext, id: ID): Promise<HotelBooking> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new UserInputError('预订单不存在');
        const pending = this.parsePending(booking.reschedulePendingJson);
        if (!pending) throw new UserInputError('没有在途的改期补差支付');
        const payment = await this.conn.getRepository(ctx, Payment).findOne({ where: { id: pending.paymentId as any } });
        if (payment?.state === 'Settled') {
            throw new UserInputError('补差款已支付，改期正在处理中，无法取消');
        }
        if (payment && payment.state !== 'Cancelled') {
            try {
                await this.paymentService.cancelPayment(ctx, payment.id);
            } catch (e: any) {
                // 取消失败不阻塞意向清理（支付侧超时/失败事件也会收口），留日志
                Logger.warn(
                    `cancelRescheduleSupplement booking ${booking.id} payment ${payment.id} cancel failed: ${e?.message}`,
                    loggerCtx,
                );
            }
        }
        booking.reschedulePendingJson = null;
        return this.repo(ctx).save(booking);
    }

    /**
     * 补差 Payment 状态事件入口（plugin.ts 订阅 PaymentStateTransitionEvent）：
     * - Settled → 完成改期（意向单或同步支付 metadata 定日期）
     * - Cancelled/Declined/Error → 清空在途意向
     * 路由双通道：metadata 标记（模拟支付/透传 metadata 的网关）+ 在途意向 paymentId 匹配
     * （COD 等 handler 会覆写 metadata，必须靠 booking.reschedulePendingJson 关联）。
     * 非补差支付一律 no-op。
     */
    async handleReschedulePayment(event: PaymentStateTransitionEvent): Promise<void> {
        const ctx = event.ctx;
        const meta = (event.payment.metadata ?? {}) as Record<string, any>;

        // 候选 1：metadata 标记（同步 Settled 的模拟支付在写意向前就靠它收口）
        let bookingId: number | null = null;
        if (meta.type === RESCHEDULE_PAYMENT_META_TYPE) {
            const b = Number(meta.rescheduleBookingId);
            if (Number.isFinite(b) && b > 0) bookingId = b;
        }
        // 候选 2：同订单下在途意向指向该 payment（COD handler 覆写 metadata 时的唯一可靠关联）
        if (event.order?.id != null) {
            const rows = await this.repo(ctx).find({ where: { orderId: Number(event.order.id) } });
            for (const row of rows) {
                const p = this.parsePending(row.reschedulePendingJson);
                if (p && p.paymentId === Number(event.payment.id)) {
                    bookingId = Number(row.id);
                    break;
                }
            }
        }
        if (bookingId == null) return;

        if (['Cancelled', 'Declined', 'Error'].includes(event.toState as string)) {
            try {
                const booking = await this.repo(ctx).findOne({ where: { id: bookingId } });
                const pending = this.parsePending(booking?.reschedulePendingJson);
                if (booking && pending && pending.paymentId === Number(event.payment.id)) {
                    booking.reschedulePendingJson = null;
                    await this.repo(ctx).save(booking);
                    Logger.info(
                        `Booking ${booking.id} reschedule supplement payment ${event.payment.id} ${event.toState}, pending cleared`,
                        loggerCtx,
                    );
                }
            } catch (e: any) {
                Logger.error(`handleReschedulePayment clear pending failed: ${e?.message}`, loggerCtx);
            }
            return;
        }
        if (event.toState !== 'Settled') return;

        try {
            // 锁房迁移用悲观锁，必须在事务内：
            // - 同步 Settled（createPayment 事务内派发事件）→ withTransaction 复用当前事务
            // - 异步 Settled（支付回调/管理员结算，事件线程无事务）→ 新开事务
            await this.conn.withTransaction(ctx, async txCtx => {
                const booking = await this.repo(txCtx).findOne({ where: { id: bookingId } });
                if (!booking) {
                    Logger.warn(`Reschedule supplement settled but booking ${bookingId} missing`, loggerCtx);
                    return;
                }
                if (booking.status !== 'confirmed') {
                    // 已取消/已入住等：钱已收但不能改期，需人工退补差
                    Logger.error(
                        `Reschedule supplement payment ${event.payment.id} settled but booking ${bookingId} is ${booking.status}; manual refund required`,
                        loggerCtx,
                    );
                    return;
                }
                const pending = this.parsePending(booking.reschedulePendingJson);
                if (pending && pending.paymentId !== Number(event.payment.id)) {
                    Logger.warn(
                        `Reschedule payment ${event.payment.id} does not match pending payment ${pending.paymentId} on booking ${bookingId}; ignored`,
                        loggerCtx,
                    );
                    return;
                }
                const checkIn = pending?.checkIn ?? toDateOnly(meta.rescheduleCheckIn);
                const checkOut = pending?.checkOut ?? toDateOnly(meta.rescheduleCheckOut);
                if (!checkIn || !checkOut) {
                    Logger.error(
                        `Reschedule payment ${event.payment.id} settled without target dates on booking ${bookingId}; manual handling required`,
                        loggerCtx,
                    );
                    return;
                }
                // 意向重复事件/并发收口：已改过则幂等成功返回
                if ((booking.rescheduleCount ?? 0) >= HOTEL_MAX_RESCHEDULES_V1) return;
                const target = await this.buildRescheduleTarget(txCtx, booking, { checkIn, checkOut });
                await this.applyReschedule(txCtx, booking, target, { payment: event.payment });
                Logger.info(
                    `Booking ${booking.id} reschedule applied via settled supplement payment ${event.payment.id}`,
                    loggerCtx,
                );
            });
        } catch (e: any) {
            // 支付后改期失败（典型：支付期间房态被抢）：保留原预订与在途意向，补差需人工经售后退款
            Logger.error(
                `handleReschedulePayment booking ${bookingId} apply failed: ${e?.message}; supplement payment ${event.payment.id} settled, manual refund required`,
                loggerCtx,
            );
        }
    }

    /** 改期前置守卫：状态 + 限次 + 在途补差 */
    private assertReschedulable(booking: HotelBooking): void {
        if (booking.status !== 'confirmed') {
            throw new UserInputError(`当前状态 ${booking.status} 不可改期`);
        }
        if ((booking.rescheduleCount ?? 0) >= HOTEL_MAX_RESCHEDULES_V1) {
            throw new UserInputError('该订单已使用改期机会（每单限改 1 次），请联系酒店/客服');
        }
        if (booking.reschedulePendingJson) {
            throw new UserInputError('该订单已有改期补差价支付在途，请完成支付或取消后重试');
        }
    }

    /** 规则 + 房态 + 价格，构造改期目标（不通过直接 UserInputError） */
    private async buildRescheduleTarget(
        ctx: RequestContext,
        booking: HotelBooking,
        dto: { checkIn: string; checkOut: string },
        now?: Date,
    ): Promise<{
        checkIn: string;
        checkOut: string;
        nights: number;
        expectedTotalCent: number;
        diffCent: number;
        availability: HotelRescheduleNight[];
    }> {
        const checkIn = toDateOnly(dto.checkIn);
        const checkOut = toDateOnly(dto.checkOut);
        if (!checkIn || !checkOut) throw new UserInputError('新入离日期不合法');
        const { cfg, planAdjust } = await this.resolveRoomContext(ctx, booking);
        const rule = evaluateRescheduleRules({
            status: booking.status,
            rescheduleCount: booking.rescheduleCount ?? 0,
            oldCheckIn: booking.checkIn,
            oldCheckOut: booking.checkOut,
            newCheckIn: checkIn,
            newCheckOut: checkOut,
            advanceDays: cfg?.advanceDays,
            minNights: cfg?.minNights,
            maxNights: cfg?.maxNights,
            now,
        });
        if (!rule.ok) throw new UserInputError(rule.message);
        const availability = await this.rescheduleAvailability(ctx, booking, checkIn, checkOut);
        const sold = availability.find(a => !a.feasible);
        if (sold) {
            throw new UserInputError(
                sold.closed ? `日期 ${sold.date} 已关房，无法改期` : `日期 ${sold.date} 房量不足，无法改期`,
            );
        }
        const pricing = calcNightlyPricing(cfg, checkIn, checkOut, planAdjust?.adjustType ? (planAdjust as any) : null);
        if (!pricing) throw new UserInputError('房价配置异常，暂时无法改期');
        const expectedTotalCent = Math.round(pricing.stayTotalCent);
        return {
            checkIn,
            checkOut,
            nights: rule.nights,
            expectedTotalCent,
            diffCent: expectedTotalCent - booking.totalCent,
            availability,
        };
    }

    private parsePending(raw: string | null | undefined): ReschedulePendingJson | null {
        if (!raw) return null;
        try {
            const obj = JSON.parse(raw) as Partial<ReschedulePendingJson>;
            if (
                typeof obj.checkIn === 'string' &&
                typeof obj.checkOut === 'string' &&
                typeof obj.paymentId === 'number'
            ) {
                return obj as ReschedulePendingJson;
            }
        } catch {
            // 坏 JSON 视为无在途意向
        }
        return null;
    }

    /**
     * 改期落地（须在调用方事务内；事件/直提两路复用）：
     * 1. 重新加载并重验规则/房态（支付期间可能被抢房）
     * 2. 释放旧 booked 锁 → holdForOrder 权威重验并落新段 hold → confirmLocks 转 booked
     * 3. 订单行自定义字段改日期 → OrderModifier/OrderCalculator 重定价（酒店计价策略按新日期逐晚计价）
     * 4. 多退少补：退差走售后系统单自动退款；补差校验 Settled Payment 覆盖差额（舍入多收 >1 分退回）
     * 5. booking 日期/晚数/总额/次数/取消截止点固化，清在途意向
     */
    private async applyReschedule(
        ctx: RequestContext,
        booking: HotelBooking,
        targetRef: { checkIn: string; checkOut: string },
        opts: { payment: Payment | null },
    ): Promise<HotelBooking> {
        const fresh = await this.repo(ctx).findOne({ where: { id: Number(booking.id) } });
        if (!fresh) throw new UserInputError('预订单不存在');
        if (fresh.status !== 'confirmed') throw new UserInputError(`当前状态 ${fresh.status} 不可改期`);
        if ((fresh.rescheduleCount ?? 0) >= HOTEL_MAX_RESCHEDULES_V1) {
            throw new UserInputError('该订单已使用改期机会');
        }
        await this.assertNoActiveAfterSales(ctx, fresh);
        const target = await this.buildRescheduleTarget(ctx, fresh, targetRef);

        const order = await this.orderService.findOne(ctx, fresh.orderId, [
            'channels',
            'customer',
            'lines',
            'lines.productVariant',
            'lines.featuredAsset',
            'lines.taxCategory',
            'shippingLines',
            'surcharges',
            'payments',
        ] as any);
        if (!order) throw new UserInputError('订单不存在');
        const line = (order.lines ?? []).find(l => Number(l.id) === fresh.orderLineId);
        if (!line) throw new UserInputError('订单酒店行不存在');

        // 锁房迁移：先释放本行旧 booked 锁，再在新段落 hold（内部悲观锁+逐晚余量权威校验），随后转 booked
        await this.inventory.releaseLocksByOrderLine(ctx, fresh.orderLineId);
        try {
            await this.inventory.holdForOrder(
                ctx,
                order.id,
                fresh.productVariantId,
                target.checkIn,
                target.checkOut,
                Math.max(1, fresh.roomCount),
                { orderLineId: fresh.orderLineId, toReleaseLineIds: [fresh.orderLineId] },
            );
        } catch (e) {
            if (e instanceof HotelSoldOutError) {
                const first = e.shortNights[0];
                throw new UserInputError(
                    first?.reason === 'closed' ? `日期 ${first?.date ?? ''} 已关房，无法改期` : `日期 ${first?.date ?? ''} 房量不足，无法改期`,
                );
            }
            throw e;
        }
        await this.inventory.confirmLocks(ctx, order.id, fresh.productVariantId, {
            orderLineId: fresh.orderLineId,
            bookingId: fresh.id,
        });

        // 订单行日期 + 重定价（与 active order adjustOrderLine 同一套内部机制，跳过 active-only 状态守卫）
        const oldCf = ((line as any).customFields ?? {}) as Record<string, any>;
        (line as any).customFields = {
            ...oldCf,
            hotelCheckIn: target.checkIn,
            hotelCheckOut: target.checkOut,
            hotelNights: target.nights,
        };
        await this.orderModifier.updateOrderLineQuantity(ctx, line, Math.max(1, fresh.roomCount), order);
        const updatedOrder = await this.orderService.applyPriceAdjustments(ctx, order, [line]);
        const freshLine = (updatedOrder.lines ?? []).find(l => Number(l.id) === fresh.orderLineId);
        const newTotalCent = freshLine ? bookingTotalCent(freshLine as any) : 0;
        if (!(newTotalCent > 0)) throw new UserInputError('改期计价失败，请重试或联系客服');

        // 多退少补
        const oldTotalCent = fresh.totalCent;
        if (newTotalCent < oldTotalCent) {
            const refundCent = oldTotalCent - newTotalCent;
            if (!this.afterSales) {
                Logger.error(`applyReschedule booking ${fresh.id}: AfterSalesService unavailable`, loggerCtx);
                throw new UserInputError('退款服务暂不可用，改期未提交，请联系客服');
            }
            const reason = `${RESCHEDULE_REFUND_REASON_PREFIX} 改期退差价 ${fresh.bookingCode ?? fresh.id}（${fresh.checkIn}→${target.checkIn}）`;
            const req = await this.afterSales.createSystemRequest(ctx, {
                orderId: fresh.orderId,
                orderLineId: fresh.orderLineId,
                type: 'refund_only',
                reason,
                description: `改期前 ${oldTotalCent} 分，改期后 ${newTotalCent} 分，退差 ${refundCent} 分`,
                refundAmount: refundCent,
            });
            const approved = await this.afterSales.approveRequest(ctx, req.id);
            if (approved.state !== 'Refunded') {
                throw new UserInputError(`退差价未成功（售后单 ${req.id} 状态 ${approved.state}），改期未提交`);
            }
        } else if (newTotalCent > oldTotalCent) {
            const pay = opts.payment;
            if (!pay || pay.state !== 'Settled') {
                throw new UserInputError('改期补差款未到账，改期未提交');
            }
            const paidCent = Math.max(0, Math.round(Number(pay.amount) || 0));
            const needCent = newTotalCent - oldTotalCent;
            if (paidCent + 1 < needCent) {
                throw new UserInputError(`改期补差金额不足（需 ${needCent} 分，实付 ${paidCent} 分），改期未提交`);
            }
            // 舍入多收（>1 分）走售后退回，保证订单总额口径一致
            const overshootCent = oldTotalCent + paidCent - newTotalCent;
            if (overshootCent > 1 && this.afterSales) {
                const req = await this.afterSales.createSystemRequest(ctx, {
                    orderId: fresh.orderId,
                    orderLineId: fresh.orderLineId,
                    type: 'refund_only',
                    reason: `${RESCHEDULE_REFUND_REASON_PREFIX} 改期补差舍入退回 ${fresh.bookingCode ?? fresh.id}`,
                    refundAmount: overshootCent,
                });
                await this.afterSales.approveRequest(ctx, req.id);
            }
        }

        // 预订固化
        fresh.checkIn = target.checkIn;
        fresh.checkOut = target.checkOut;
        fresh.nights = target.nights;
        fresh.totalCent = newTotalCent;
        fresh.rescheduleCount = (fresh.rescheduleCount ?? 0) + 1;
        fresh.rescheduledAt = new Date();
        fresh.reschedulePendingJson = null;
        const { cfg, policy } = await this.resolveRoomContext(ctx, fresh);
        // 列类型为 Date|undefined，但语义要求可清空（新政策无免费窗口）→ null 落库
        (fresh as any).cancelDeadlineAt = deriveCancelDeadline(policy, fresh.checkIn, cfg?.checkInTime) ?? null;
        const saved = await this.repo(ctx).save(fresh);
        Logger.info(
            `Booking ${saved.id} rescheduled: ${oldTotalCent}→${newTotalCent}, ${saved.checkIn}/${saved.checkOut}, count ${saved.rescheduleCount}`,
            loggerCtx,
        );
        return saved;
    }
}
