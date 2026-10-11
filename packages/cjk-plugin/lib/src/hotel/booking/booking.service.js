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
let HotelBookingService = class HotelBookingService {
    constructor(conn, inventory, ratePlans) {
        this.conn = conn;
        this.inventory = inventory;
        this.ratePlans = ratePlans;
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
    /** 有效取消政策解析：方案级 cancelPolicyOverride 优先（坏 JSON 回退），再回退房型 hotelRoomConfig.cancelPolicy */
    async resolvePolicy(ctx, b) {
        var _a, _b, _c, _d;
        let policy;
        let planAdjust = null;
        if (b.ratePlanCode) {
            const plans = await this.ratePlans.findByCodes(ctx, b.productVariantId, [b.ratePlanCode]);
            const plan = plans[0];
            if (plan) {
                planAdjust = { adjustType: String((_a = plan.adjustType) !== null && _a !== void 0 ? _a : ''), adjustValue: Number((_b = plan.adjustValue) !== null && _b !== void 0 ? _b : 0) };
            }
            const raw = plan === null || plan === void 0 ? void 0 : plan.cancelPolicyOverride;
            if (raw) {
                try {
                    policy = JSON.parse(raw);
                }
                catch (_e) {
                    policy = null; // 坏 JSON 回退房型级政策
                }
            }
        }
        const variant = await this.conn
            .getRepository(ctx, core_1.ProductVariant)
            .findOne({ where: { id: Number(b.productVariantId) } });
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_c = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _c === void 0 ? void 0 : _c.hotelRoomConfig);
        if (!policy)
            policy = (_d = cfg === null || cfg === void 0 ? void 0 : cfg.cancelPolicy) !== null && _d !== void 0 ? _d : null;
        return { policy: policy !== null && policy !== void 0 ? policy : null, planAdjust };
    }
    /** 取消截止点固化：checkInTime 取房型配置（缺省 00:00） */
    async deriveDeadline(ctx, b) {
        var _a;
        const { policy } = await this.resolvePolicy(ctx, b);
        const variant = await this.conn
            .getRepository(ctx, core_1.ProductVariant)
            .findOne({ where: { id: Number(b.productVariantId) } });
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_a = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _a === void 0 ? void 0 : _a.hotelRoomConfig);
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
};
exports.HotelBookingService = HotelBookingService;
exports.HotelBookingService = HotelBookingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        hotel_inventory_service_1.HotelInventoryService,
        rate_plan_service_1.HotelRatePlanService])
], HotelBookingService);
//# sourceMappingURL=booking.service.js.map