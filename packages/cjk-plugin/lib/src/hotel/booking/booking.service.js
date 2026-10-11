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
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const hotel_nightly_pricing_1 = require("../hotel-nightly-pricing");
const hotel_inventory_service_1 = require("./hotel-inventory.service");
const hotel_inventory_logic_1 = require("./hotel-inventory-logic");
const rate_plan_service_1 = require("./rate-plan.service");
const booking_logic_1 = require("./booking-logic");
const booking_entity_1 = require("./booking.entity");
const loggerCtx = 'HotelBookingService';
/** 可取消（管理员强制取消）的状态白名单 */
const CANCELLABLE_STATUSES = ['pendingDeposit', 'confirmed'];
/** 补差支付 metadata 标记（PaymentStateTransitionEvent 路由用） */
const RESCHEDULE_PAYMENT_META_TYPE = 'hotelRescheduleSupplement';
/**
 * 改期退差/补差舍入退回的系统售后单 reason 前缀标记。
 * handleAfterSalesRefunded 凭此区分「取消退款」与「改期多退少补」：
 * 改期退款完成不得触发取消收口（否则会把新段锁房释放并把预订置 cancelled）。
 */
const RESCHEDULE_REFUND_REASON_PREFIX = '[hotel-reschedule-refund]';
let HotelBookingService = class HotelBookingService {
    constructor(conn, inventory, ratePlans, orderService, orderModifier, paymentService) {
        this.conn = conn;
        this.inventory = inventory;
        this.ratePlans = ratePlans;
        this.orderService = orderService;
        this.orderModifier = orderModifier;
        this.paymentService = paymentService;
        /** after-sales 插件由 plugin.ts onInit 延迟注入（跨插件依赖，规避模块初始化顺序） */
        this.afterSales = null;
    }
    setAfterSalesService(svc) {
        this.afterSales = svc;
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
        var _a;
        const where = {};
        if (filter.status)
            where.status = filter.status;
        if (filter.variantId != null)
            where.productVariantId = Number(filter.variantId);
        if (filter.orderId != null)
            where.orderId = Number(filter.orderId);
        if (filter.orderCode)
            where.orderCode = filter.orderCode;
        // 租户隔离：channelToken 存 booking 时为创建渠道；admin 会话经 vendure-token 绑定渠道后只看本渠道
        if ((_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.token)
            where.channelToken = ctx.channel.token;
        const rows = await this.repo(ctx).find({ where, order: { id: 'DESC' }, take });
        await this.enrichVariantNames(ctx, rows);
        return rows;
    }
    /** 批量补房型名（非持久化字段，仅 admin 列表展示；按 ctx 语言取 translation） */
    async enrichVariantNames(ctx, rows) {
        var _a, _b, _c, _d;
        const ids = [...new Set(rows.map(r => Number(r.productVariantId)))].filter(n => Number.isFinite(n));
        if (!ids.length)
            return;
        const lang = String((_a = ctx.languageCode) !== null && _a !== void 0 ? _a : '');
        const variants = await this.conn.getRepository(ctx, core_1.ProductVariant).find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: ['translations'],
        });
        const names = new Map();
        for (const v of variants) {
            const trs = ((_b = v.translations) !== null && _b !== void 0 ? _b : []);
            const hit = (_c = trs.find(t => String(t.languageCode) === lang)) !== null && _c !== void 0 ? _c : trs[0];
            names.set(Number(v.id), String((_d = hit === null || hit === void 0 ? void 0 : hit.name) !== null && _d !== void 0 ? _d : '').trim());
        }
        for (const r of rows) {
            r.variantName = names.get(Number(r.productVariantId)) || null;
        }
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
            // 已取消且关联退款售后单（Task 14）：行随退款链路终结，即使退款引发订单状态事件重放，
            // 也绝不重建/重确认幻影预订（无售后单的旧取消仍保留「取消后重走支付重建」边缘能力）
            if (existing && existing.afterSalesRequestId != null)
                continue;
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
    /**
     * 房型计价上下文：variant + 解析后的 hotelRoomConfig + 有效取消政策 + 房价方案调整。
     * 有效取消政策：方案级 cancelPolicyOverride 优先（坏 JSON 回退房型级），再回退房型 cancelPolicy。
     */
    async resolveRoomContext(ctx, b) {
        var _a, _b, _c, _d, _e, _f;
        const variant = (_a = (await this.conn
            .getRepository(ctx, core_1.ProductVariant)
            .findOne({ where: { id: Number(b.productVariantId) } }))) !== null && _a !== void 0 ? _a : null;
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_b = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _b === void 0 ? void 0 : _b.hotelRoomConfig);
        let policy = (_c = cfg === null || cfg === void 0 ? void 0 : cfg.cancelPolicy) !== null && _c !== void 0 ? _c : null;
        let planAdjust = null;
        if (b.ratePlanCode) {
            const plans = await this.ratePlans.findByCodes(ctx, b.productVariantId, [b.ratePlanCode]);
            const plan = plans[0];
            if (plan) {
                planAdjust = { adjustType: String((_d = plan.adjustType) !== null && _d !== void 0 ? _d : ''), adjustValue: Number((_e = plan.adjustValue) !== null && _e !== void 0 ? _e : 0) };
            }
            const raw = plan === null || plan === void 0 ? void 0 : plan.cancelPolicyOverride;
            if (raw) {
                try {
                    policy = JSON.parse(raw);
                }
                catch (_g) {
                    policy = (_f = cfg === null || cfg === void 0 ? void 0 : cfg.cancelPolicy) !== null && _f !== void 0 ? _f : null; // 坏 JSON 回退房型级政策
                }
            }
        }
        return { variant, cfg, policy: policy !== null && policy !== void 0 ? policy : null, planAdjust };
    }
    /** 有效取消政策解析（Task 14；语义保留，实现转调 resolveRoomContext） */
    async resolvePolicy(ctx, b) {
        const { policy, planAdjust } = await this.resolveRoomContext(ctx, b);
        return { policy, planAdjust };
    }
    /** 取消截止点固化：checkInTime 取房型配置（缺省 00:00） */
    async deriveDeadline(ctx, b) {
        const { cfg, policy } = await this.resolveRoomContext(ctx, b);
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
    // ===== P4 Task 14：取消报价 / 取消退款 =====
    /**
     * 取消报价（design §8）：解析有效政策 + 已结算实付 + 首晚房费，交纯函数 computeCancelQuote。
     * 可取消状态白名单之外（已入住/已完成/noShow/已取消）一律拒绝。
     */
    async quoteCancel(ctx, id, now) {
        var _a;
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new Error('预订单不存在');
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            throw new Error(`当前状态 ${booking.status} 不可取消`);
        }
        const { policy, planAdjust } = await this.resolvePolicy(ctx, booking);
        const paidCent = await this.settledPaidCent(ctx, booking.orderId);
        const firstNightFeeCent = await this.firstNightFeeCent(ctx, booking, policy, planAdjust);
        const quote = (0, booking_logic_1.computeCancelQuote)({
            status: booking.status,
            policy,
            deadline: (_a = booking.cancelDeadlineAt) !== null && _a !== void 0 ? _a : null,
            now,
            totalCent: booking.totalCent,
            paidCent,
            firstNightFeeCent,
        });
        return { booking, quote, paidCent, firstNightFeeCent };
    }
    /** 订单已结算（Settled）支付合计（分）；仅 Settled 可走 refundOrder 退款，Authorized 不计 */
    async settledPaidCent(ctx, orderId) {
        var _a;
        const order = await this.conn.getRepository(ctx, core_1.Order).findOne({
            where: { id: orderId },
            relations: ['payments'],
        });
        const payments = ((_a = order === null || order === void 0 ? void 0 : order.payments) !== null && _a !== void 0 ? _a : []);
        return payments
            .filter(p => p.state === 'Settled')
            .reduce((sum, p) => sum + Math.round(Number(p.amount) || 0), 0);
    }
    /**
     * 首晚房费（全部房间合计，分）：服务端用房型配置+方案重算（hotelNightly 不落库）；
     * 配置缺失/重算失败时兜底 ceil(成交总额/晚数)，保证扣款口径非 0。
     */
    async firstNightFeeCent(ctx, b, policy, planAdjust) {
        var _a, _b, _c;
        if ((policy === null || policy === void 0 ? void 0 : policy.partial) === 'full')
            return b.totalCent;
        try {
            const variant = await this.conn
                .getRepository(ctx, core_1.ProductVariant)
                .findOne({ where: { id: Number(b.productVariantId) } });
            const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_a = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _a === void 0 ? void 0 : _a.hotelRoomConfig);
            const pricing = (0, hotel_nightly_pricing_1.calcNightlyPricing)(cfg, b.checkIn, b.checkOut, (planAdjust === null || planAdjust === void 0 ? void 0 : planAdjust.adjustType) ? planAdjust : null);
            const perRoom = (_c = (_b = pricing === null || pricing === void 0 ? void 0 : pricing.nights) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.priceCent;
            if (typeof perRoom === 'number' && perRoom > 0)
                return perRoom * Math.max(1, b.roomCount);
        }
        catch (e) {
            core_1.Logger.warn(`firstNightFeeCent booking ${b.id} recompute failed: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
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
    async cancelByCustomer(ctx, id, reason) {
        var _a;
        const { booking, quote, paidCent } = await this.quoteCancel(ctx, id);
        await this.assertNoActiveAfterSales(ctx, booking);
        if (!quote.cancellable) {
            throw new Error('该订单暂不支持线上自助取消，请联系酒店/客服处理');
        }
        const userReason = (reason !== null && reason !== void 0 ? reason : '').trim();
        const baseReason = `预订取消 ${(_a = booking.bookingCode) !== null && _a !== void 0 ? _a : booking.id}${userReason ? `｜${userReason}` : ''}`;
        if (quote.mode === 'unpaid' || quote.mode === 'forfeit') {
            return this.finalizeCancel(ctx, booking, {
                feeCent: quote.mode === 'forfeit' ? paidCent : 0,
                reason: baseReason,
            });
        }
        if (!this.afterSales) {
            // 售后插件缺失：免费/部分退款无法走钱，禁止自助取消（防止漏退款）
            core_1.Logger.error(`cancelByCustomer booking ${booking.id}: AfterSalesService unavailable`, loggerCtx);
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
                throw new Error(`退款未成功（售后单 ${req.id} 状态 ${approved.state}），预订保留，请稍后重试或联系客服`);
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
        core_1.Logger.info(`Booking ${saved.id} cancel requested, after-sales ${req.id} pending approval (fee ${quote.feeCent})`, loggerCtx);
        return saved;
    }
    /**
     * 管理员强制取消（升级）：
     * - 已有售后单在途 → 拒绝（防止双退；退款完成事件会自动收口）
     * - 有已结算款 → 建售后单全额退款并自动审批，Refunded 后才置 cancelled + 释放锁房
     * - 无结算款 / 售后插件缺失（仅遗留环境）→ 直接取消释放
     */
    async forceCancel(ctx, id, reason) {
        var _a;
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new Error('预订单不存在');
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            throw new Error(`当前状态 ${booking.status} 不可取消`);
        }
        await this.assertNoActiveAfterSales(ctx, booking);
        const adminReason = `商家强制取消 ${(_a = booking.bookingCode) !== null && _a !== void 0 ? _a : booking.id}${(reason !== null && reason !== void 0 ? reason : '').trim() ? `｜${(reason !== null && reason !== void 0 ? reason : '').trim()}` : ''}`;
        const paidCent = await this.settledPaidCent(ctx, booking.orderId);
        if (paidCent <= 0 || !this.afterSales) {
            if (paidCent > 0) {
                core_1.Logger.warn(`forceCancel booking ${booking.id}: AfterSalesService unavailable, cancelling without refund`, loggerCtx);
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
    async handleAfterSalesRefunded(event) {
        var _a;
        if (event.toState !== 'Refunded')
            return;
        const ctx = event.ctx;
        try {
            const req = await this.conn.getRepository(ctx, after_sales_plugin_1.AfterSalesRequest).findOne({
                where: { id: Number(event.requestId) },
            });
            if (!req || req.orderLineId == null)
                return;
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
            if (!booking || !CANCELLABLE_STATUSES.includes(booking.status))
                return;
            const paidCent = await this.settledPaidCent(ctx, booking.orderId);
            const actualRefund = req.actualRefundAmount != null
                ? Math.max(0, Math.round(req.actualRefundAmount))
                : Math.max(0, Math.round(req.refundAmount || 0));
            const feeCent = Math.max(0, paidCent - actualRefund);
            await this.finalizeCancel(ctx, booking, {
                feeCent,
                reason: (_a = booking.cancelReason) !== null && _a !== void 0 ? _a : `售后退款完成自动取消（售后单 ${req.id}）`,
                afterSalesRequestId: Number(req.id),
            });
        }
        catch (e) {
            core_1.Logger.error(`handleAfterSalesRefunded request ${event.requestId} failed: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
        }
    }
    /**
     * 售后单在途守卫：关联单处于 Pending/Approved/Received/RefundFailed 等活动态 → 阻断（防双退）；
     * Rejected/Closed → 视为已终结，清空关联放行（可重新发起）；Refunded 理论上 booking 已收口，亦阻断。
     */
    async assertNoActiveAfterSales(ctx, booking) {
        var _a;
        if (booking.afterSalesRequestId == null)
            return;
        const req = await this.conn.getRepository(ctx, after_sales_plugin_1.AfterSalesRequest).findOne({
            where: { id: booking.afterSalesRequestId },
        });
        const state = String((_a = req === null || req === void 0 ? void 0 : req.state) !== null && _a !== void 0 ? _a : '');
        if (state === 'Rejected' || state === 'Closed') {
            booking.afterSalesRequestId = null;
            await this.repo(ctx).update(booking.id, { afterSalesRequestId: null });
            return;
        }
        throw new Error(`该预订已有退款售后单 ${booking.afterSalesRequestId}${state ? `（${state}）` : ''}处理中，请在售后管理中完成`);
    }
    /** 取消收口：置 cancelled + 扣款快照 + 释放该行全部 lock（幂等） */
    async finalizeCancel(ctx, booking, opts) {
        var _a;
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = opts.reason;
        booking.cancelFeeCent = Math.max(0, Math.round(opts.feeCent));
        if (opts.afterSalesRequestId != null)
            booking.afterSalesRequestId = opts.afterSalesRequestId;
        const saved = await this.repo(ctx).save(booking);
        await this.inventory.releaseLocksByOrderLine(ctx, saved.orderLineId);
        core_1.Logger.info(`Booking ${saved.id} cancelled (fee ${saved.cancelFeeCent}, after-sales ${(_a = saved.afterSalesRequestId) !== null && _a !== void 0 ? _a : '-'})`, loggerCtx);
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
    // ===== P4 Task 15：在线改期（报价 / 提交 / 补差支付收口） =====
    /**
     * 改期报价（不落库）：
     * - 规则（confirmed + V1 限改 1 次 + advanceDays/min/maxNights）不通过 → eligible=false + reason
     * - 房态：逐晚把「本单旧段内自身 booked 锁」加回余量后判定 feasible
     * - 价格：与 HotelOrderItemPriceCalculationStrategy 同口径（calcNightlyPricing.stayTotalCent，
     *   quantity=间数时策略除间数再乘回，行小计≈住宿总价）；最终以提交时重算订单行为准
     */
    async quoteReschedule(ctx, id, dto, now) {
        var _a, _b, _c;
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new core_1.UserInputError('预订单不存在');
        const newCheckIn = (_a = (0, booking_logic_1.toDateOnly)(dto.checkIn)) !== null && _a !== void 0 ? _a : '';
        const newCheckOut = (_b = (0, booking_logic_1.toDateOnly)(dto.checkOut)) !== null && _b !== void 0 ? _b : '';
        const base = {
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
        const rule = (0, booking_logic_1.evaluateRescheduleRules)({
            status: booking.status,
            rescheduleCount: (_c = booking.rescheduleCount) !== null && _c !== void 0 ? _c : 0,
            oldCheckIn: booking.checkIn,
            oldCheckOut: booking.checkOut,
            newCheckIn,
            newCheckOut,
            advanceDays: cfg === null || cfg === void 0 ? void 0 : cfg.advanceDays,
            minNights: cfg === null || cfg === void 0 ? void 0 : cfg.minNights,
            maxNights: cfg === null || cfg === void 0 ? void 0 : cfg.maxNights,
            now,
        });
        if (!rule.ok) {
            return Object.assign(Object.assign({}, base), { reason: rule.reason, message: rule.message });
        }
        const availability = await this.rescheduleAvailability(ctx, booking, newCheckIn, newCheckOut);
        const sold = availability.find(a => !a.feasible);
        const pricing = (0, hotel_nightly_pricing_1.calcNightlyPricing)(cfg, newCheckIn, newCheckOut, (planAdjust === null || planAdjust === void 0 ? void 0 : planAdjust.adjustType) ? planAdjust : null);
        const newTotalCent = pricing ? Math.round(pricing.stayTotalCent) : null;
        const diffCent = newTotalCent == null ? null : newTotalCent - booking.totalCent;
        return Object.assign(Object.assign({}, base), { nights: rule.nights, eligible: !sold && newTotalCent != null, reason: sold ? 'soldOut' : newTotalCent == null ? 'pricingError' : undefined, message: sold
                ? sold.closed
                    ? `日期 ${sold.date} 已关房，无法改期`
                    : `日期 ${sold.date} 房量不足，无法改期`
                : newTotalCent == null
                    ? '房价配置异常，暂时无法改期'
                    : undefined, newTotalCent,
            diffCent, refundCent: diffCent == null ? null : Math.max(0, -diffCent), supplementCent: diffCent == null ? null : Math.max(0, diffCent), availability });
    }
    /** 逐晚可行性：旧段内的晚把本单 roomCount 间自身锁加回（移动锁房的净占用口径） */
    async rescheduleAvailability(ctx, booking, newCheckIn, newCheckOut) {
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
    async rescheduleByCustomer(ctx, id, dto) {
        var _a, _b, _c, _d, _e;
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new core_1.UserInputError('预订单不存在');
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
        const method = String((_a = dto.paymentMethod) !== null && _a !== void 0 ? _a : '').trim();
        if (!method) {
            throw new core_1.UserInputError(`改期后需补差价 ¥${(target.diffCent / 100).toFixed(2)}，请选择支付方式后提交`);
        }
        const order = await this.orderService.findOne(ctx, booking.orderId, ['payments']);
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        if (order.state !== 'PaymentSettled') {
            // PartiallyPaid（首付未付清）改期涉及定金比例重算，V1 不支持，引导客服
            throw new core_1.UserInputError('仅已全额支付的预订支持线上改期补差，请联系客服处理');
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
        if (payment instanceof Error || payment.errorCode) {
            throw new core_1.UserInputError(`补差支付发起失败：${(_c = (_b = payment.eligibilityCheckerMessage) !== null && _b !== void 0 ? _b : payment.message) !== null && _c !== void 0 ? _c : '支付方式不可用'}`);
        }
        const pay = payment;
        const paymentPublic = ((_e = (_d = pay.metadata) === null || _d === void 0 ? void 0 : _d.public) !== null && _e !== void 0 ? _e : null);
        if (pay.state === 'Settled') {
            // createPayment 事务内已同步派发 Settled 事件 → handleReschedulePayment 已完成改期，此处只回读
            const done = await this.repo(ctx).findOne({ where: { id: Number(booking.id) } });
            return {
                booking: done !== null && done !== void 0 ? done : booking,
                applied: true,
                paymentState: 'Settled',
                paymentId: Number(pay.id),
                supplementCent: target.diffCent,
                paymentPublic,
            };
        }
        // 异步支付：登记待支付意向（不动订单/锁房/价格；支付完成前预订一切照旧）
        const pending = {
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
        core_1.Logger.info(`Booking ${saved.id} reschedule supplement pending: payment ${pay.id} (${pay.state}), ${saved.checkIn}→${target.checkIn}`, loggerCtx);
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
    async cancelRescheduleSupplement(ctx, id) {
        const booking = await this.repo(ctx).findOne({ where: { id: Number(id) } });
        if (!booking)
            throw new core_1.UserInputError('预订单不存在');
        const pending = this.parsePending(booking.reschedulePendingJson);
        if (!pending)
            throw new core_1.UserInputError('没有在途的改期补差支付');
        const payment = await this.conn.getRepository(ctx, core_1.Payment).findOne({ where: { id: pending.paymentId } });
        if ((payment === null || payment === void 0 ? void 0 : payment.state) === 'Settled') {
            throw new core_1.UserInputError('补差款已支付，改期正在处理中，无法取消');
        }
        if (payment && payment.state !== 'Cancelled') {
            try {
                await this.paymentService.cancelPayment(ctx, payment.id);
            }
            catch (e) {
                // 取消失败不阻塞意向清理（支付侧超时/失败事件也会收口），留日志
                core_1.Logger.warn(`cancelRescheduleSupplement booking ${booking.id} payment ${payment.id} cancel failed: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
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
    async handleReschedulePayment(event) {
        var _a, _b;
        const ctx = event.ctx;
        const meta = ((_a = event.payment.metadata) !== null && _a !== void 0 ? _a : {});
        // 候选 1：metadata 标记（同步 Settled 的模拟支付在写意向前就靠它收口）
        let bookingId = null;
        if (meta.type === RESCHEDULE_PAYMENT_META_TYPE) {
            const b = Number(meta.rescheduleBookingId);
            if (Number.isFinite(b) && b > 0)
                bookingId = b;
        }
        // 候选 2：同订单下在途意向指向该 payment（COD handler 覆写 metadata 时的唯一可靠关联）
        if (((_b = event.order) === null || _b === void 0 ? void 0 : _b.id) != null) {
            const rows = await this.repo(ctx).find({ where: { orderId: Number(event.order.id) } });
            for (const row of rows) {
                const p = this.parsePending(row.reschedulePendingJson);
                if (p && p.paymentId === Number(event.payment.id)) {
                    bookingId = Number(row.id);
                    break;
                }
            }
        }
        if (bookingId == null)
            return;
        if (['Cancelled', 'Declined', 'Error'].includes(event.toState)) {
            try {
                const booking = await this.repo(ctx).findOne({ where: { id: bookingId } });
                const pending = this.parsePending(booking === null || booking === void 0 ? void 0 : booking.reschedulePendingJson);
                if (booking && pending && pending.paymentId === Number(event.payment.id)) {
                    booking.reschedulePendingJson = null;
                    await this.repo(ctx).save(booking);
                    core_1.Logger.info(`Booking ${booking.id} reschedule supplement payment ${event.payment.id} ${event.toState}, pending cleared`, loggerCtx);
                }
            }
            catch (e) {
                core_1.Logger.error(`handleReschedulePayment clear pending failed: ${e === null || e === void 0 ? void 0 : e.message}`, loggerCtx);
            }
            return;
        }
        if (event.toState !== 'Settled')
            return;
        try {
            // 锁房迁移用悲观锁，必须在事务内：
            // - 同步 Settled（createPayment 事务内派发事件）→ withTransaction 复用当前事务
            // - 异步 Settled（支付回调/管理员结算，事件线程无事务）→ 新开事务
            await this.conn.withTransaction(ctx, async (txCtx) => {
                var _a, _b, _c;
                const booking = await this.repo(txCtx).findOne({ where: { id: bookingId } });
                if (!booking) {
                    core_1.Logger.warn(`Reschedule supplement settled but booking ${bookingId} missing`, loggerCtx);
                    return;
                }
                if (booking.status !== 'confirmed') {
                    // 已取消/已入住等：钱已收但不能改期，需人工退补差
                    core_1.Logger.error(`Reschedule supplement payment ${event.payment.id} settled but booking ${bookingId} is ${booking.status}; manual refund required`, loggerCtx);
                    return;
                }
                const pending = this.parsePending(booking.reschedulePendingJson);
                if (pending && pending.paymentId !== Number(event.payment.id)) {
                    core_1.Logger.warn(`Reschedule payment ${event.payment.id} does not match pending payment ${pending.paymentId} on booking ${bookingId}; ignored`, loggerCtx);
                    return;
                }
                const checkIn = (_a = pending === null || pending === void 0 ? void 0 : pending.checkIn) !== null && _a !== void 0 ? _a : (0, booking_logic_1.toDateOnly)(meta.rescheduleCheckIn);
                const checkOut = (_b = pending === null || pending === void 0 ? void 0 : pending.checkOut) !== null && _b !== void 0 ? _b : (0, booking_logic_1.toDateOnly)(meta.rescheduleCheckOut);
                if (!checkIn || !checkOut) {
                    core_1.Logger.error(`Reschedule payment ${event.payment.id} settled without target dates on booking ${bookingId}; manual handling required`, loggerCtx);
                    return;
                }
                // 意向重复事件/并发收口：已改过则幂等成功返回
                if (((_c = booking.rescheduleCount) !== null && _c !== void 0 ? _c : 0) >= booking_logic_1.HOTEL_MAX_RESCHEDULES_V1)
                    return;
                const target = await this.buildRescheduleTarget(txCtx, booking, { checkIn, checkOut });
                await this.applyReschedule(txCtx, booking, target, { payment: event.payment });
                core_1.Logger.info(`Booking ${booking.id} reschedule applied via settled supplement payment ${event.payment.id}`, loggerCtx);
            });
        }
        catch (e) {
            // 支付后改期失败（典型：支付期间房态被抢）：保留原预订与在途意向，补差需人工经售后退款
            core_1.Logger.error(`handleReschedulePayment booking ${bookingId} apply failed: ${e === null || e === void 0 ? void 0 : e.message}; supplement payment ${event.payment.id} settled, manual refund required`, loggerCtx);
        }
    }
    /** 改期前置守卫：状态 + 限次 + 在途补差 */
    assertReschedulable(booking) {
        var _a;
        if (booking.status !== 'confirmed') {
            throw new core_1.UserInputError(`当前状态 ${booking.status} 不可改期`);
        }
        if (((_a = booking.rescheduleCount) !== null && _a !== void 0 ? _a : 0) >= booking_logic_1.HOTEL_MAX_RESCHEDULES_V1) {
            throw new core_1.UserInputError('该订单已使用改期机会（每单限改 1 次），请联系酒店/客服');
        }
        if (booking.reschedulePendingJson) {
            throw new core_1.UserInputError('该订单已有改期补差价支付在途，请完成支付或取消后重试');
        }
    }
    /** 规则 + 房态 + 价格，构造改期目标（不通过直接 UserInputError） */
    async buildRescheduleTarget(ctx, booking, dto, now) {
        var _a;
        const checkIn = (0, booking_logic_1.toDateOnly)(dto.checkIn);
        const checkOut = (0, booking_logic_1.toDateOnly)(dto.checkOut);
        if (!checkIn || !checkOut)
            throw new core_1.UserInputError('新入离日期不合法');
        const { cfg, planAdjust } = await this.resolveRoomContext(ctx, booking);
        const rule = (0, booking_logic_1.evaluateRescheduleRules)({
            status: booking.status,
            rescheduleCount: (_a = booking.rescheduleCount) !== null && _a !== void 0 ? _a : 0,
            oldCheckIn: booking.checkIn,
            oldCheckOut: booking.checkOut,
            newCheckIn: checkIn,
            newCheckOut: checkOut,
            advanceDays: cfg === null || cfg === void 0 ? void 0 : cfg.advanceDays,
            minNights: cfg === null || cfg === void 0 ? void 0 : cfg.minNights,
            maxNights: cfg === null || cfg === void 0 ? void 0 : cfg.maxNights,
            now,
        });
        if (!rule.ok)
            throw new core_1.UserInputError(rule.message);
        const availability = await this.rescheduleAvailability(ctx, booking, checkIn, checkOut);
        const sold = availability.find(a => !a.feasible);
        if (sold) {
            throw new core_1.UserInputError(sold.closed ? `日期 ${sold.date} 已关房，无法改期` : `日期 ${sold.date} 房量不足，无法改期`);
        }
        const pricing = (0, hotel_nightly_pricing_1.calcNightlyPricing)(cfg, checkIn, checkOut, (planAdjust === null || planAdjust === void 0 ? void 0 : planAdjust.adjustType) ? planAdjust : null);
        if (!pricing)
            throw new core_1.UserInputError('房价配置异常，暂时无法改期');
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
    parsePending(raw) {
        if (!raw)
            return null;
        try {
            const obj = JSON.parse(raw);
            if (typeof obj.checkIn === 'string' &&
                typeof obj.checkOut === 'string' &&
                typeof obj.paymentId === 'number') {
                return obj;
            }
        }
        catch (_a) {
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
    async applyReschedule(ctx, booking, targetRef, opts) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const fresh = await this.repo(ctx).findOne({ where: { id: Number(booking.id) } });
        if (!fresh)
            throw new core_1.UserInputError('预订单不存在');
        if (fresh.status !== 'confirmed')
            throw new core_1.UserInputError(`当前状态 ${fresh.status} 不可改期`);
        if (((_a = fresh.rescheduleCount) !== null && _a !== void 0 ? _a : 0) >= booking_logic_1.HOTEL_MAX_RESCHEDULES_V1) {
            throw new core_1.UserInputError('该订单已使用改期机会');
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
        ]);
        if (!order)
            throw new core_1.UserInputError('订单不存在');
        const line = ((_b = order.lines) !== null && _b !== void 0 ? _b : []).find(l => Number(l.id) === fresh.orderLineId);
        if (!line)
            throw new core_1.UserInputError('订单酒店行不存在');
        // 锁房迁移：先释放本行旧 booked 锁，再在新段落 hold（内部悲观锁+逐晚余量权威校验），随后转 booked
        await this.inventory.releaseLocksByOrderLine(ctx, fresh.orderLineId);
        try {
            await this.inventory.holdForOrder(ctx, order.id, fresh.productVariantId, target.checkIn, target.checkOut, Math.max(1, fresh.roomCount), { orderLineId: fresh.orderLineId, toReleaseLineIds: [fresh.orderLineId] });
        }
        catch (e) {
            if (e instanceof hotel_inventory_service_1.HotelSoldOutError) {
                const first = e.shortNights[0];
                throw new core_1.UserInputError((first === null || first === void 0 ? void 0 : first.reason) === 'closed' ? `日期 ${(_c = first === null || first === void 0 ? void 0 : first.date) !== null && _c !== void 0 ? _c : ''} 已关房，无法改期` : `日期 ${(_d = first === null || first === void 0 ? void 0 : first.date) !== null && _d !== void 0 ? _d : ''} 房量不足，无法改期`);
            }
            throw e;
        }
        await this.inventory.confirmLocks(ctx, order.id, fresh.productVariantId, {
            orderLineId: fresh.orderLineId,
            bookingId: fresh.id,
        });
        // 订单行日期 + 重定价（与 active order adjustOrderLine 同一套内部机制，跳过 active-only 状态守卫）
        const oldCf = ((_e = line.customFields) !== null && _e !== void 0 ? _e : {});
        line.customFields = Object.assign(Object.assign({}, oldCf), { hotelCheckIn: target.checkIn, hotelCheckOut: target.checkOut, hotelNights: target.nights });
        await this.orderModifier.updateOrderLineQuantity(ctx, line, Math.max(1, fresh.roomCount), order);
        const updatedOrder = await this.orderService.applyPriceAdjustments(ctx, order, [line]);
        const freshLine = ((_f = updatedOrder.lines) !== null && _f !== void 0 ? _f : []).find(l => Number(l.id) === fresh.orderLineId);
        const newTotalCent = freshLine ? (0, booking_logic_1.bookingTotalCent)(freshLine) : 0;
        if (!(newTotalCent > 0))
            throw new core_1.UserInputError('改期计价失败，请重试或联系客服');
        // 多退少补
        const oldTotalCent = fresh.totalCent;
        if (newTotalCent < oldTotalCent) {
            const refundCent = oldTotalCent - newTotalCent;
            if (!this.afterSales) {
                core_1.Logger.error(`applyReschedule booking ${fresh.id}: AfterSalesService unavailable`, loggerCtx);
                throw new core_1.UserInputError('退款服务暂不可用，改期未提交，请联系客服');
            }
            const reason = `${RESCHEDULE_REFUND_REASON_PREFIX} 改期退差价 ${(_g = fresh.bookingCode) !== null && _g !== void 0 ? _g : fresh.id}（${fresh.checkIn}→${target.checkIn}）`;
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
                throw new core_1.UserInputError(`退差价未成功（售后单 ${req.id} 状态 ${approved.state}），改期未提交`);
            }
        }
        else if (newTotalCent > oldTotalCent) {
            const pay = opts.payment;
            if (!pay || pay.state !== 'Settled') {
                throw new core_1.UserInputError('改期补差款未到账，改期未提交');
            }
            const paidCent = Math.max(0, Math.round(Number(pay.amount) || 0));
            const needCent = newTotalCent - oldTotalCent;
            if (paidCent + 1 < needCent) {
                throw new core_1.UserInputError(`改期补差金额不足（需 ${needCent} 分，实付 ${paidCent} 分），改期未提交`);
            }
            // 舍入多收（>1 分）走售后退回，保证订单总额口径一致
            const overshootCent = oldTotalCent + paidCent - newTotalCent;
            if (overshootCent > 1 && this.afterSales) {
                const req = await this.afterSales.createSystemRequest(ctx, {
                    orderId: fresh.orderId,
                    orderLineId: fresh.orderLineId,
                    type: 'refund_only',
                    reason: `${RESCHEDULE_REFUND_REASON_PREFIX} 改期补差舍入退回 ${(_h = fresh.bookingCode) !== null && _h !== void 0 ? _h : fresh.id}`,
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
        fresh.rescheduleCount = ((_j = fresh.rescheduleCount) !== null && _j !== void 0 ? _j : 0) + 1;
        fresh.rescheduledAt = new Date();
        fresh.reschedulePendingJson = null;
        const { cfg, policy } = await this.resolveRoomContext(ctx, fresh);
        // 列类型为 Date|undefined，但语义要求可清空（新政策无免费窗口）→ null 落库
        fresh.cancelDeadlineAt = (_k = (0, booking_logic_1.deriveCancelDeadline)(policy, fresh.checkIn, cfg === null || cfg === void 0 ? void 0 : cfg.checkInTime)) !== null && _k !== void 0 ? _k : null;
        const saved = await this.repo(ctx).save(fresh);
        core_1.Logger.info(`Booking ${saved.id} rescheduled: ${oldTotalCent}→${newTotalCent}, ${saved.checkIn}/${saved.checkOut}, count ${saved.rescheduleCount}`, loggerCtx);
        return saved;
    }
};
exports.HotelBookingService = HotelBookingService;
exports.HotelBookingService = HotelBookingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        hotel_inventory_service_1.HotelInventoryService,
        rate_plan_service_1.HotelRatePlanService,
        core_1.OrderService,
        core_1.OrderModifier,
        core_1.PaymentService])
], HotelBookingService);
//# sourceMappingURL=booking.service.js.map