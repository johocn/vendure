// 酒店预订单服务（P3 Task 10）：状态机流转 + 确认联动锁房。
// - 纯判定逻辑在 booking-logic.ts（可单测）；本服务只做 DB 编排
// - 确认口径（设计决策 #6）：订单状态 PartiallyPaid（支付计划首期付清）或 PaymentSettled（全额付清）
// - 事件接入（OrderEvent → handleOrderUpdated）在 Task 11 于 plugin.ts onInit 订阅
import { Injectable } from '@nestjs/common';
import { ID, Logger, Order, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { In, LessThan, LessThanOrEqual } from 'typeorm';
import {
    AfterSalesRequest,
    AfterSalesStateTransitionEvent,
} from '@vendure/after-sales-plugin';
import type { AfterSalesService } from '@vendure/after-sales-plugin';

import { CancelPolicy } from '../hotel-config';
import { calcNightlyPricing, parseHotelRoomConfig } from '../hotel-nightly-pricing';
import { HotelInventoryService } from './hotel-inventory.service';
import { enumerateNights } from './hotel-inventory-logic';
import { HotelRatePlanService } from './rate-plan.service';
import {
    HotelBookingStatus,
    HOTEL_ORDER_PENDING_STATES,
    canCheckIn,
    computeCancelQuote,
    deriveCancelDeadline,
    generateBookingCode,
    hotelDatesOfLine,
    bookingTotalCent,
    todayStr,
    type CancelQuote,
} from './booking-logic';
import { HotelBooking } from './booking.entity';

const loggerCtx = 'HotelBookingService';

/** 可取消（管理员强制取消）的状态白名单 */
const CANCELLABLE_STATUSES: HotelBookingStatus[] = ['pendingDeposit', 'confirmed'];

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

@Injectable()
export class HotelBookingService {
    /** after-sales 插件由 plugin.ts onInit 延迟注入（跨插件依赖，规避模块初始化顺序） */
    private afterSales: AfterSalesService | null = null;

    constructor(
        private conn: TransactionalConnection,
        private inventory: HotelInventoryService,
        private ratePlans: HotelRatePlanService,
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

    /** 有效取消政策解析：方案级 cancelPolicyOverride 优先（坏 JSON 回退），再回退房型 hotelRoomConfig.cancelPolicy */
    private async resolvePolicy(
        ctx: RequestContext,
        b: HotelBooking,
    ): Promise<{ policy: CancelPolicy | null; planAdjust: { adjustType: string; adjustValue: number } | null }> {
        let policy: CancelPolicy | null | undefined;
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
                    policy = JSON.parse(raw);
                } catch {
                    policy = null; // 坏 JSON 回退房型级政策
                }
            }
        }
        const variant = await this.conn
            .getRepository(ctx, ProductVariant)
            .findOne({ where: { id: Number(b.productVariantId) } });
        const cfg = parseHotelRoomConfig((variant?.customFields as any)?.hotelRoomConfig);
        if (!policy) policy = cfg?.cancelPolicy ?? null;
        return { policy: policy ?? null, planAdjust };
    }

    /** 取消截止点固化：checkInTime 取房型配置（缺省 00:00） */
    private async deriveDeadline(ctx: RequestContext, b: HotelBooking): Promise<Date | null> {
        const { policy } = await this.resolvePolicy(ctx, b);
        const variant = await this.conn
            .getRepository(ctx, ProductVariant)
            .findOne({ where: { id: Number(b.productVariantId) } });
        const cfg = parseHotelRoomConfig((variant?.customFields as any)?.hotelRoomConfig);
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
}
