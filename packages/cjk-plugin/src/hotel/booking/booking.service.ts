// 酒店预订单服务（P3 Task 10）：状态机流转 + 确认联动锁房。
// - 纯判定逻辑在 booking-logic.ts（可单测）；本服务只做 DB 编排
// - 确认口径（设计决策 #6）：订单状态 PartiallyPaid（支付计划首期付清）或 PaymentSettled（全额付清）
// - 事件接入（OrderEvent → handleOrderUpdated）在 Task 11 于 plugin.ts onInit 订阅
import { Injectable } from '@nestjs/common';
import { ID, Logger, Order, ProductVariant, RequestContext, TransactionalConnection } from '@vendure/core';
import { LessThan, LessThanOrEqual } from 'typeorm';

import { CancelPolicy } from '../hotel-config';
import { parseHotelRoomConfig } from '../hotel-nightly-pricing';
import { HotelInventoryService } from './hotel-inventory.service';
import { enumerateNights } from './hotel-inventory-logic';
import { HotelRatePlanService } from './rate-plan.service';
import {
    HotelBookingStatus,
    HOTEL_ORDER_PENDING_STATES,
    canCheckIn,
    deriveCancelDeadline,
    generateBookingCode,
    hotelDatesOfLine,
    bookingTotalCent,
    todayStr,
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

@Injectable()
export class HotelBookingService {
    constructor(
        private conn: TransactionalConnection,
        private inventory: HotelInventoryService,
        private ratePlans: HotelRatePlanService,
    ) {}

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
        return this.repo(ctx).find({ where, order: { id: 'DESC' }, take });
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
            b.cancelDeadlineAt = await this.deriveDeadline(ctx, b);
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

    /** 取消截止点固化：方案级 cancelPolicyOverride 优先，回退房型 hotelRoomConfig.cancelPolicy；checkInTime 取房型配置 */
    private async deriveDeadline(ctx: RequestContext, b: HotelBooking): Promise<Date | null> {
        let policy: CancelPolicy | null | undefined;
        if (b.ratePlanCode) {
            const plans = await this.ratePlans.findByCodes(ctx, b.productVariantId, [b.ratePlanCode]);
            const raw = plans[0]?.cancelPolicyOverride as string | null | undefined;
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
        return deriveCancelDeadline(policy, b.checkIn, cfg?.checkInTime);
    }

    // ===== 事件入口（Task 11 于 plugin.ts 订阅 OrderEvent 调用） =====

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

    /**
     * 管理员强制取消：pendingDeposit/confirmed → cancelled 并释放锁房。
     * 退款走 Task 14 售后单（本方法不处理钱）。
     */
    async forceCancel(ctx: RequestContext, id: ID, reason?: string): Promise<HotelBooking> {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking) throw new Error('预订单不存在');
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            throw new Error(`当前状态 ${booking.status} 不可取消`);
        }
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = (reason ?? '').trim() || null;
        const saved = await this.repo(ctx).save(booking);
        await this.inventory.releaseLocksByOrderLine(ctx, saved.orderLineId);
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
