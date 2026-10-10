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
exports.HotelBookingService = void 0;
// 酒店预订单服务（P3 Task 10）：状态机流转 + 确认联动锁房。
// - 纯判定逻辑在 booking-logic.ts（可单测）；本服务只做 DB 编排
// - 确认口径（设计决策 #6）：订单状态 PartiallyPaid（支付计划首期付清）或 PaymentSettled（全额付清）
// - 事件接入（OrderEvent → handleOrderUpdated）在 Task 11 于 plugin.ts onInit 订阅
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const hotel_nightly_pricing_1 = require("../hotel-nightly-pricing");
const hotel_inventory_service_1 = require("./hotel-inventory.service");
const hotel_inventory_logic_1 = require("./hotel-inventory-logic");
const rate_plan_service_1 = require("./rate-plan.service");
const booking_logic_1 = require("./booking-logic");
const booking_entity_1 = require("./booking.entity");
const loggerCtx = 'HotelBookingService';
/** 可取消（管理员强制取消）的状态白名单 */
const CANCELLABLE_STATUSES = ['pendingDeposit', 'confirmed'];
let HotelBookingService = class HotelBookingService {
    constructor(conn, inventory, ratePlans) {
        this.conn = conn;
        this.inventory = inventory;
        this.ratePlans = ratePlans;
    }
    repo(ctx) {
        return this.conn.getRepository(ctx, booking_entity_1.HotelBooking);
    }
    // ===== 查询 =====
    async listByOrder(ctx, orderId) {
        return this.repo(ctx).find({ where: { orderId: Number(orderId) }, order: { id: 'ASC' } });
    }
    /** 订单行当前预订单（最新一条；同一行重建场景取 id 最大） */
    async getByOrderLine(ctx, orderLineId) {
        return this.repo(ctx).findOne({ where: { orderLineId: Number(orderLineId) }, order: { id: 'DESC' } });
    }
    async findByCode(ctx, code) {
        const c = String(code !== null && code !== void 0 ? code : '').trim();
        if (!/^\d{8}$/.test(c))
            return null;
        return this.repo(ctx).findOne({ where: { bookingCode: c } });
    }
    /** 商家端简版列表（Task 13 预订管理页数据源；id DESC 尾页语义，上限 200） */
    async listForAdmin(ctx, filter = {}, take = 200) {
        const where = {};
        if (filter.status)
            where.status = filter.status;
        if (filter.variantId != null)
            where.productVariantId = Number(filter.variantId);
        if (filter.orderId != null)
            where.orderId = Number(filter.orderId);
        if (filter.orderCode)
            where.orderCode = filter.orderCode;
        return this.repo(ctx).find({ where, order: { id: 'DESC' }, take });
    }
    /** C 端「我的预订」：按顾客名下订单 id 集合过滤（归属隔离在 resolver 层做），可选状态过滤 */
    async listForCustomer(ctx, orderIds, status) {
        if (!orderIds.length)
            return [];
        const where = { orderId: (0, typeorm_1.In)(orderIds) };
        if (status)
            where.status = status;
        return this.repo(ctx).find({ where, order: { id: 'DESC' }, take: 200 });
    }
    // ===== 状态机：建单（pendingDeposit） =====
    /**
     * 幂等创建 pending 预订单（per 酒店订单行）：
     * - 行已有非 cancelled booking → 跳过；若仍为 pendingDeposit 则同步可能变化的日期/数量/金额
     * - 行仅有 cancelled 旧 booking（整单取消后重走支付等边缘）→ 重建新 pending 行
     */
    async ensurePendingBookings(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g;
        const created = [];
        for (const line of (_a = order.lines) !== null && _a !== void 0 ? _a : []) {
            const cf = (_b = line.customFields) !== null && _b !== void 0 ? _b : {};
            const dates = (0, booking_logic_1.hotelDatesOfLine)(cf);
            if (!dates)
                continue; // 非酒店行零侵入
            const variantId = Number((_d = (_c = line.productVariant) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : line.productVariantId);
            if (!Number.isFinite(variantId) || variantId <= 0)
                continue;
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
            const booking = await this.repo(ctx).save(new booking_entity_1.HotelBooking({
                bookingCode: null,
                orderId: Number(order.id),
                orderLineId: Number(line.id),
                orderCode: (_e = order.code) !== null && _e !== void 0 ? _e : null,
                channelToken: (_g = (_f = ctx.channel) === null || _f === void 0 ? void 0 : _f.token) !== null && _g !== void 0 ? _g : null,
                productVariantId: variantId,
                checkIn: dates.checkIn,
                checkOut: dates.checkOut,
                nights: (0, hotel_inventory_logic_1.enumerateNights)(dates.checkIn, dates.checkOut).length,
                roomCount: line.quantity,
                status: 'pendingDeposit',
                ratePlanCode: (cf.ratePlanCode || null),
                totalCent: (0, booking_logic_1.bookingTotalCent)(line),
                guestName: guest.name,
                guestPhone: guest.phone,
            }));
            created.push(booking);
        }
        return created;
    }
    /** pending 阶段与订单行保持一致（加购后调整日期/数量/方案的场景） */
    async syncPendingWithLine(ctx, booking, order, line, dates, variantId) {
        var _a;
        const cf = (_a = line.customFields) !== null && _a !== void 0 ? _a : {};
        const nights = (0, hotel_inventory_logic_1.enumerateNights)(dates.checkIn, dates.checkOut).length;
        const patch = {};
        if (booking.checkIn !== dates.checkIn)
            patch.checkIn = dates.checkIn;
        if (booking.checkOut !== dates.checkOut)
            patch.checkOut = dates.checkOut;
        if (booking.nights !== nights)
            patch.nights = nights;
        if (booking.roomCount !== line.quantity)
            patch.roomCount = line.quantity;
        if (booking.productVariantId !== variantId)
            patch.productVariantId = variantId;
        const planCode = (cf.ratePlanCode || null);
        if (booking.ratePlanCode !== planCode)
            patch.ratePlanCode = planCode;
        const total = (0, booking_logic_1.bookingTotalCent)(line);
        if (booking.totalCent !== total)
            patch.totalCent = total;
        const guest = this.guestOf(order, cf);
        if (!booking.guestName && guest.name)
            patch.guestName = guest.name;
        if (!booking.guestPhone && guest.phone)
            patch.guestPhone = guest.phone;
        if (Object.keys(patch).length) {
            await this.repo(ctx).update(booking.id, patch);
        }
    }
    /** 客人信息：行 customFields（预留）→ 订单客户 → 收货地址 */
    guestOf(order, cf) {
        var _a, _b, _c, _d, _e;
        const name = (typeof cf.hotelGuestName === 'string' && cf.hotelGuestName.trim()) ||
            [(_a = order.customer) === null || _a === void 0 ? void 0 : _a.lastName, (_b = order.customer) === null || _b === void 0 ? void 0 : _b.firstName].filter(Boolean).join(' ').trim() ||
            ((_c = order.shippingAddress) === null || _c === void 0 ? void 0 : _c.fullName) ||
            null;
        const phone = (typeof cf.hotelGuestPhone === 'string' && cf.hotelGuestPhone.trim()) ||
            ((_d = order.shippingAddress) === null || _d === void 0 ? void 0 : _d.phoneNumber) ||
            ((_e = order.customer) === null || _e === void 0 ? void 0 : _e.phoneNumber) ||
            null;
        return { name: name || null, phone: phone || null };
    }
    // ===== 状态机：确认（confirmed） =====
    /**
     * 幂等确认订单下全部 pending 预订单：生成入住码 + 固化取消截止点 + hold→booked。
     * 状态守卫在调用方（handleOrderUpdated 按订单状态判断）。
     */
    async confirmPendingForOrder(ctx, orderId) {
        var _a;
        const pending = await this.repo(ctx).find({ where: { orderId: Number(orderId), status: 'pendingDeposit' } });
        const confirmed = [];
        for (const b of pending) {
            b.bookingCode = await this.allocateCode(ctx);
            // deriveDeadline 可能为 null（无政策/nonRefundable）——列已是 null，undefined = 保持不变
            b.cancelDeadlineAt = (_a = (await this.deriveDeadline(ctx, b))) !== null && _a !== void 0 ? _a : undefined;
            b.confirmedAt = new Date();
            b.status = 'confirmed';
            const saved = await this.repo(ctx).save(b);
            await this.inventory.confirmLocks(ctx, saved.orderId, saved.productVariantId, {
                orderLineId: saved.orderLineId,
                bookingId: saved.id,
            });
            confirmed.push(saved);
            core_1.Logger.info(`Booking ${saved.id} confirmed (order ${saved.orderId}, code ${saved.bookingCode})`, loggerCtx);
        }
        return confirmed;
    }
    /** 8 位入住码分配：随机 + 查重重试，5 次未命中回退时间戳后 8 位（唯一索引兜底） */
    async allocateCode(ctx, attempts = 5) {
        for (let i = 0; i < attempts; i++) {
            const code = (0, booking_logic_1.generateBookingCode)();
            const dup = await this.repo(ctx).findOne({ where: { bookingCode: code } });
            if (!dup)
                return code;
        }
        return String(Date.now() % 100000000).padStart(8, '0');
    }
    /** 取消截止点固化：方案级 cancelPolicyOverride 优先，回退房型 hotelRoomConfig.cancelPolicy；checkInTime 取房型配置 */
    async deriveDeadline(ctx, b) {
        var _a, _b, _c;
        let policy;
        if (b.ratePlanCode) {
            const plans = await this.ratePlans.findByCodes(ctx, b.productVariantId, [b.ratePlanCode]);
            const raw = (_a = plans[0]) === null || _a === void 0 ? void 0 : _a.cancelPolicyOverride;
            if (raw) {
                try {
                    policy = JSON.parse(raw);
                }
                catch (_d) {
                    policy = null; // 坏 JSON 回退房型级政策
                }
            }
        }
        const variant = await this.conn
            .getRepository(ctx, core_1.ProductVariant)
            .findOne({ where: { id: Number(b.productVariantId) } });
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_b = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _b === void 0 ? void 0 : _b.hotelRoomConfig);
        if (!policy)
            policy = (_c = cfg === null || cfg === void 0 ? void 0 : cfg.cancelPolicy) !== null && _c !== void 0 ? _c : null;
        return (0, booking_logic_1.deriveCancelDeadline)(policy, b.checkIn, cfg === null || cfg === void 0 ? void 0 : cfg.checkInTime);
    }
    // ===== 事件入口（Task 11 于 plugin.ts 订阅 OrderEvent/OrderStateTransitionEvent 调用） =====
    /**
     * OrderStateTransitionEvent 入口：事件携带的 order 不保证加载 lines/customer，
     * 按 id 重取完整订单后复用 handleOrderUpdated（幂等，双路触发无副作用）。
     */
    async handleOrderTransition(ctx, orderId) {
        const order = await this.conn.getRepository(ctx, core_1.Order).findOne({
            where: { id: Number(orderId) },
            relations: ['lines', 'customer'],
        });
        if (!order)
            return;
        await this.handleOrderUpdated(ctx, order);
    }
    /**
     * 订单更新 reconcile：
     * - 无酒店行 / 状态不在可处理集合 → no-op
     * - PENDING_STATES → ensure 幂等建单
     * - PartiallyPaid（首期付清）/ PaymentSettled（全清）→ confirm
     */
    async handleOrderUpdated(ctx, order) {
        var _a, _b;
        const lines = (_a = order.lines) !== null && _a !== void 0 ? _a : [];
        if (lines.length === 0)
            return;
        if (!booking_logic_1.HOTEL_ORDER_PENDING_STATES.includes(order.state))
            return;
        const hasHotel = lines.some(l => !!(0, booking_logic_1.hotelDatesOfLine)(l.customFields));
        if (!hasHotel)
            return;
        try {
            await this.ensurePendingBookings(ctx, order);
            const state = order.state;
            if (state === 'PartiallyPaid' || state === 'PaymentSettled') {
                await this.confirmPendingForOrder(ctx, order.id);
            }
        }
        catch (e) {
            // 事件链路不阻断主流程，留日志排查
            core_1.Logger.error(`handleOrderUpdated order ${(_b = order.code) !== null && _b !== void 0 ? _b : order.id} failed: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
        }
    }
    // ===== 核销 / 完成 / 取消 =====
    /** 到店核销：凭 id 或 8 位入住码；仅 confirmed 且当日 ∈ [checkIn, checkOut) */
    async checkIn(ctx, input) {
        let booking = null;
        if (input.code != null && String(input.code).trim() !== '') {
            booking = await this.findByCode(ctx, String(input.code));
            if (!booking)
                throw new Error('入住码不存在');
        }
        else if (input.id != null) {
            booking = await this.repo(ctx).findOne({ where: { id: Number(input.id) } });
        }
        if (!booking)
            throw new Error('预订单不存在');
        const today = (0, booking_logic_1.todayStr)();
        if (!(0, booking_logic_1.canCheckIn)(booking.status, booking.checkIn, booking.checkOut, today)) {
            throw new Error(`当前不可入住（状态 ${booking.status}，入住日 ${booking.checkIn}）`);
        }
        booking.status = 'checkedIn';
        booking.checkedInAt = new Date();
        return this.repo(ctx).save(booking);
    }
    /** 手动完成离店：仅 checkedIn 可完成（日常定时任务兜底自动完成） */
    async complete(ctx, id) {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new Error('预订单不存在');
        if (booking.status !== 'checkedIn')
            throw new Error(`当前状态 ${booking.status} 不可完成离店`);
        booking.status = 'completed';
        booking.completedAt = new Date();
        return this.repo(ctx).save(booking);
    }
    /**
     * 管理员强制取消：pendingDeposit/confirmed → cancelled 并释放锁房。
     * 退款走 Task 14 售后单（本方法不处理钱）。
     */
    async forceCancel(ctx, id, reason) {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new Error('预订单不存在');
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            throw new Error(`当前状态 ${booking.status} 不可取消`);
        }
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = (reason !== null && reason !== void 0 ? reason : '').trim() || null;
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
    async runDailyTransitions(ctx, now) {
        var _a, _b;
        const today = (0, booking_logic_1.todayStr)(now);
        const done = await this.repo(ctx)
            .update({ status: 'checkedIn', checkOut: (0, typeorm_1.LessThanOrEqual)(today) }, { status: 'completed', completedAt: new Date() });
        const nos = await this.repo(ctx)
            .update({ status: 'confirmed', checkOut: (0, typeorm_1.LessThan)(today) }, { status: 'noShow' });
        return { completed: (_a = done.affected) !== null && _a !== void 0 ? _a : 0, noShow: (_b = nos.affected) !== null && _b !== void 0 ? _b : 0 };
    }
};
exports.HotelBookingService = HotelBookingService;
exports.HotelBookingService = HotelBookingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        hotel_inventory_service_1.HotelInventoryService,
        rate_plan_service_1.HotelRatePlanService])
], HotelBookingService);
//# sourceMappingURL=booking.service.js.map