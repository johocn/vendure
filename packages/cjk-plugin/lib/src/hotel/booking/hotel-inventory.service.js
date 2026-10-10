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
exports.HotelInventoryService = exports.HotelSoldOutError = void 0;
// 房态库存与锁房服务（P1）：
// - 防超订：hold/confirm/release 三态锁房单 + 事务内悲观行锁（SELECT…FOR UPDATE，mysql/pg 通用 setLock）
// - 校验与落锁必须由调用方保证在同一事务内（OrderInterceptor 处于 mutation 事务；非事务上下文用 withTransaction 自包）
// - 房量回退：HotelRoomDay 行 ?? hotelRoomConfig.totalRooms ?? 不限房（null）
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const hotel_nightly_pricing_1 = require("../hotel-nightly-pricing");
const hotel_config_1 = require("../hotel-config");
const room_day_entity_1 = require("./room-day.entity");
const booking_lock_entity_1 = require("./booking-lock.entity");
const hotel_inventory_logic_1 = require("./hotel-inventory-logic");
Object.defineProperty(exports, "HotelSoldOutError", { enumerable: true, get: function () { return hotel_inventory_logic_1.HotelSoldOutError; } });
const loggerCtx = 'HotelInventoryService';
let HotelInventoryService = class HotelInventoryService {
    constructor(conn) {
        this.conn = conn;
    }
    roomDayRepo(ctx) {
        return this.conn.getRepository(ctx, room_day_entity_1.HotelRoomDay);
    }
    lockRepo(ctx) {
        return this.conn.getRepository(ctx, booking_lock_entity_1.HotelBookingLock);
    }
    /** 变体缺省总房量（hotelRoomConfig.totalRooms）；坏配置/未配置 → null（不限房） */
    async getVariantTotalRooms(ctx, variantId) {
        var _a;
        const variant = await this.conn.getRepository(ctx, core_1.ProductVariant).findOne({
            where: { id: variantId },
            loadEagerRelations: false,
        });
        if (!variant)
            return null;
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_a = variant.customFields) === null || _a === void 0 ? void 0 : _a.hotelRoomConfig);
        const n = cfg === null || cfg === void 0 ? void 0 : cfg.totalRooms;
        return typeof n === 'number' && n >= 0 ? Math.round(n) : null;
    }
    /** 逐晚剩余房量（from..to 含 checkIn 不含 checkOut 段内每一晚） */
    async getAvailability(ctx, variantId, from, to) {
        const nights = (0, hotel_inventory_logic_1.enumerateNights)(from, to);
        if (!nights.length)
            return [];
        const configTotal = await this.getVariantTotalRooms(ctx, variantId);
        const roomDays = await this.roomDayRepo(ctx).find({ where: { productVariantId: Number(variantId), date: (0, typeorm_1.In)(nights) } });
        const roomDayByDate = new Map(roomDays.map(r => [r.date, r]));
        // 有限房量的晚才需要统计占用；不限房的晚直接 null
        const limitedDates = nights.filter(d => roomDayByDate.has(d) || configTotal != null);
        const occupied = new Map();
        if (limitedDates.length) {
            const locks = await this.lockRepo(ctx).find({
                where: { productVariantId: Number(variantId), date: (0, typeorm_1.In)(limitedDates) },
            });
            const now = new Date();
            for (const d of limitedDates) {
                occupied.set(d, (0, hotel_inventory_logic_1.countOccupied)(locks, d, now));
            }
        }
        return nights.map(date => {
            var _a, _b;
            const roomDay = roomDayByDate.get(date);
            return {
                date,
                remaining: (0, hotel_inventory_logic_1.computeRemaining)(roomDay, configTotal, (_a = occupied.get(date)) !== null && _a !== void 0 ? _a : 0),
                closed: (_b = roomDay === null || roomDay === void 0 ? void 0 : roomDay.closed) !== null && _b !== void 0 ? _b : false,
            };
        });
    }
    /**
     * 逐晚房态 + 当晚报价（date/priceCent/dayType/remaining/closed）。
     * shop hotelAvailability / admin 房量日历共用；窗口语义由调用方决定（含两端时传 to+1）。
     */
    async getAvailabilityDetailed(ctx, variantId, from, to) {
        var _a;
        const rows = await this.getAvailability(ctx, variantId, from, to);
        const variant = await this.conn.getRepository(ctx, core_1.ProductVariant).findOne({
            where: { id: variantId },
            loadEagerRelations: false,
        });
        const cfg = (0, hotel_nightly_pricing_1.parseHotelRoomConfig)((_a = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _a === void 0 ? void 0 : _a.hotelRoomConfig);
        const segments = Array.isArray(cfg === null || cfg === void 0 ? void 0 : cfg.priceCalendar) ? cfg.priceCalendar : [];
        return rows.map(r => {
            var _a, _b, _c;
            const pricing = (0, hotel_nightly_pricing_1.calcNightlyPricing)(cfg, r.date, (0, hotel_inventory_logic_1.nextDate)(r.date));
            return {
                date: r.date,
                priceCent: (_c = (_b = (_a = pricing === null || pricing === void 0 ? void 0 : pricing.nights[0]) === null || _a === void 0 ? void 0 : _a.priceCent) !== null && _b !== void 0 ? _b : cfg === null || cfg === void 0 ? void 0 : cfg.basePriceCent) !== null && _c !== void 0 ? _c : 0,
                dayType: (0, hotel_config_1.dayTypeFor)(r.date, segments),
                remaining: r.remaining,
                closed: r.closed,
            };
        });
    }
    /**
     * 锁房（校验 + 落锁，一体完成，须在调用方事务内）：
     * - 对段内「有限房量」的 HotelRoomDay 行悲观加锁（无行时先 upsert 缺省行以获得锁锚点）
     * - 释放「本次会重置」的 hold：orderLineId 为 null 的孤儿 + toReleaseLineIds 指定行的（幂等自愈，
     *   同房型多行重叠段时互不影响——只重置属于本次操作的锁）
     * - 逐晚校验 remaining ≥ 新增间数（统计扣除待释放集），任一晚不足抛 HotelSoldOutError
     * - 落 hold（每间每晚一行，TTL 15min）；不限房晚不落锁
     */
    async holdForOrder(ctx, orderId, variantId, checkIn, checkOut, quantity, options = {}) {
        var _a, _b, _c;
        const nights = (0, hotel_inventory_logic_1.enumerateNights)(checkIn, checkOut);
        if (!nights.length || quantity < 1)
            return;
        const vId = Number(variantId);
        const configTotal = await this.getVariantTotalRooms(ctx, vId);
        // 缺省行 upsert：仅当「有限房量」且无显式行时补一行（把回退值固化成锁锚点）
        const existing = await this.roomDayRepo(ctx).find({ where: { productVariantId: vId, date: (0, typeorm_1.In)(nights) } });
        const existingDates = new Set(existing.map(r => r.date));
        if (configTotal != null) {
            for (const date of nights.filter(d => !existingDates.has(d))) {
                await this.roomDayRepo(ctx).insert({ productVariantId: vId, date, totalRooms: configTotal, closed: false });
            }
        }
        // 悲观锁：锁定段内全部 roomDay 行（不限房晚若无行则无行可锁——本就不参与占用统计）
        if (existing.length || configTotal != null) {
            await this.roomDayRepo(ctx)
                .createQueryBuilder('rd')
                .setLock('pessimistic_write')
                .where('rd.productVariantId = :vId', { vId })
                .andWhere('rd.date IN (:...dates)', { dates: nights })
                .getMany();
        }
        const roomDays = await this.roomDayRepo(ctx).find({ where: { productVariantId: vId, date: (0, typeorm_1.In)(nights) } });
        const roomDayByDate = new Map(roomDays.map(r => [r.date, r]));
        const limitedDates = nights.filter(d => roomDayByDate.has(d) || configTotal != null);
        const now = new Date();
        // 待重置集：本单该房型的 null 孤儿（上次 willAdd 落的）+ 指定行（本行/同段旧行）的 hold
        const releaseLineIds = ((_a = options.toReleaseLineIds) !== null && _a !== void 0 ? _a : []).map(Number);
        const toRelease = await this.lockRepo(ctx).find({
            where: { orderId: Number(orderId), productVariantId: vId, status: 'hold' },
        });
        const toReleaseIds = new Set(toRelease.filter(l => l.orderLineId == null || releaseLineIds.includes(l.orderLineId)).map(l => l.id));
        const occupiedByDate = new Map();
        if (limitedDates.length) {
            const locks = await this.lockRepo(ctx).find({
                where: { productVariantId: vId, date: (0, typeorm_1.In)(limitedDates) },
            });
            for (const d of limitedDates) {
                occupiedByDate.set(d, (0, hotel_inventory_logic_1.countOccupied)(locks, d, now, toReleaseIds));
            }
        }
        const remainingByDate = new Map();
        for (const d of nights) {
            remainingByDate.set(d, (0, hotel_inventory_logic_1.computeRemaining)(roomDayByDate.get(d), configTotal, (_b = occupiedByDate.get(d)) !== null && _b !== void 0 ? _b : 0));
        }
        const short = (0, hotel_inventory_logic_1.findShortNights)(nights, remainingByDate, quantity);
        if (short.length) {
            // closed 晚 remaining 也是 0，按 roomDay 行标注 reason（前端区分「关房/满房」文案）
            for (const s of short) {
                if ((_c = roomDayByDate.get(s.date)) === null || _c === void 0 ? void 0 : _c.closed)
                    s.reason = 'closed';
            }
            throw new hotel_inventory_logic_1.HotelSoldOutError(short, vId);
        }
        // 释放待重置集（幂等），再按最终数量落新 hold
        if (toReleaseIds.size) {
            await this.lockRepo(ctx).update({ id: (0, typeorm_1.In)([...toReleaseIds]) }, { status: 'released', holdExpiresAt: null });
        }
        const expiresAt = new Date(now.getTime() + hotel_inventory_logic_1.HOTEL_HOLD_TTL_MINUTES * 60000);
        const rows = [];
        for (const date of nights) {
            if (!roomDayByDate.has(date) && configTotal == null)
                continue; // 不限房不落锁
            for (let i = 0; i < quantity; i++) {
                rows.push({
                    productVariantId: vId,
                    date,
                    orderId: Number(orderId),
                    orderLineId: options.orderLineId != null ? Number(options.orderLineId) : null,
                    bookingId: null,
                    status: 'hold',
                    holdExpiresAt: expiresAt,
                });
            }
        }
        if (rows.length) {
            await this.lockRepo(ctx).insert(rows);
        }
    }
    /** hold → booked（确认）：可选回填 orderLineId / bookingId；已 booked 的行跳过 */
    async confirmLocks(ctx, orderId, variantId, options = {}) {
        const patch = { status: 'booked', holdExpiresAt: null };
        if (options.orderLineId != null)
            patch.orderLineId = Number(options.orderLineId);
        if (options.bookingId != null)
            patch.bookingId = Number(options.bookingId);
        await this.lockRepo(ctx).update({ orderId: Number(orderId), productVariantId: Number(variantId), status: 'hold' }, patch);
    }
    /** 任意状态 → released（取消/退款/移除行）；released 幂等 */
    async releaseLocks(ctx, orderId, variantId) {
        var _a;
        const where = { orderId: Number(orderId), status: (0, typeorm_1.Not)('released') };
        if (variantId != null)
            where.productVariantId = Number(variantId);
        const res = await this.lockRepo(ctx).update(where, { status: 'released', holdExpiresAt: null });
        return (_a = res.affected) !== null && _a !== void 0 ? _a : 0;
    }
    /** 按订单行释放（移除订单行） */
    async releaseLocksByOrderLine(ctx, orderLineId) {
        var _a;
        const res = await this.lockRepo(ctx).update({ orderLineId: Number(orderLineId), status: (0, typeorm_1.Not)('released') }, { status: 'released', holdExpiresAt: null });
        return (_a = res.affected) !== null && _a !== void 0 ? _a : 0;
    }
    /**
     * 释放（订单 × 房型 × 日期段内）orderLineId 为 null 的 hold 孤儿。
     * willAdd 落锁时行尚未创建只能落 null；移除行时按行上日期段回溯释放。
     * 同 variant + 同 customFields 的加购 core 会合并为一行，故段不重叠互不误伤。
     */
    async releaseOrphanHolds(ctx, orderId, variantId, checkIn, checkOut) {
        var _a;
        const nights = (0, hotel_inventory_logic_1.enumerateNights)(checkIn, checkOut);
        if (!nights.length)
            return 0;
        const res = await this.lockRepo(ctx).update({
            orderId: Number(orderId),
            productVariantId: Number(variantId),
            date: (0, typeorm_1.In)(nights),
            orderLineId: (0, typeorm_1.IsNull)(),
            status: (0, typeorm_1.Not)('released'),
        }, { status: 'released', holdExpiresAt: null });
        return (_a = res.affected) !== null && _a !== void 0 ? _a : 0;
    }
    /** 定时清理：过期 hold → released（清理统计面；released 行保留审计） */
    async expireStaleHolds(ctx, now) {
        var _a;
        const res = await this.lockRepo(ctx)
            .createQueryBuilder()
            .update(booking_lock_entity_1.HotelBookingLock)
            .set({ status: 'released', holdExpiresAt: null })
            .where('status = :status', { status: 'hold' })
            .andWhere('holdExpiresAt IS NOT NULL')
            .andWhere('holdExpiresAt < :now', { now: now !== null && now !== void 0 ? now : new Date() })
            .execute();
        if (res.affected) {
            core_1.Logger.info(`过期锁房单释放 ${res.affected} 行`, loggerCtx);
        }
        return (_a = res.affected) !== null && _a !== void 0 ? _a : 0;
    }
    /** 行创建后回填 orderLineId（按订单+房型，补齐审计链） */
    async attachOrderLineId(ctx, orderId, variantId, orderLineId) {
        await this.lockRepo(ctx).update({ orderId: Number(orderId), productVariantId: Number(variantId), orderLineId: (0, typeorm_1.IsNull)() }, { orderLineId: Number(orderLineId) });
    }
    // ===== Admin 房量管理（房量日历） =====
    /** 某月已建房量行（month = YYYY-MM） */
    async listRoomDays(ctx, variantId, month) {
        if (!/^\d{4}-\d{2}$/.test(month))
            return [];
        const [y, m] = month.split('-').map(Number);
        const first = `${month}-01`;
        const lastDate = new Date(y, m, 0).getDate(); // 当月天数（m 为 1-based，Date(y, m, 0) 即月末）
        const last = `${month}-${String(lastDate).padStart(2, '0')}`;
        return this.roomDayRepo(ctx).find({
            where: { productVariantId: Number(variantId), date: (0, typeorm_1.Between)(first, last) },
            order: { date: 'ASC' },
        });
    }
    /** upsert 单日房量（totalRooms/closed 可选，只更新传入字段；无行则建） */
    async upsertRoomDay(ctx, variantId, date, patch) {
        var _a, _b, _c;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`非法日期: ${date}`);
        }
        if (patch.totalRooms != null && (patch.totalRooms < 0 || !Number.isFinite(patch.totalRooms))) {
            throw new Error(`非法房量: ${patch.totalRooms}`);
        }
        const repo = this.roomDayRepo(ctx);
        let row = await repo.findOne({ where: { productVariantId: Number(variantId), date } });
        if (!row) {
            const configTotal = await this.getVariantTotalRooms(ctx, variantId);
            row = await repo.save(repo.create({
                productVariantId: Number(variantId),
                date,
                totalRooms: (_b = (_a = patch.totalRooms) !== null && _a !== void 0 ? _a : configTotal) !== null && _b !== void 0 ? _b : 0,
                closed: (_c = patch.closed) !== null && _c !== void 0 ? _c : false,
            }));
        }
        else {
            if (patch.totalRooms != null)
                row.totalRooms = Math.round(patch.totalRooms);
            if (patch.closed != null)
                row.closed = patch.closed;
            await repo.save(row);
        }
        return row;
    }
    /**
     * 批量 upsert [from, to] 含两端（weekdays 可选 0-6 过滤，0=周日）。
     * 返回写入行数；任一日期非法即整体失败（调用方事务内）。
     */
    async batchUpsertRoomDays(ctx, variantId, from, to, patch) {
        var _a;
        const nights = (0, hotel_inventory_logic_1.enumerateNights)(from, (0, hotel_inventory_logic_1.nextDate)(to)); // 含两端窗口
        if (!nights.length)
            throw new Error(`非法日期区间: ${from} ~ ${to}`);
        const weekdays = ((_a = patch.weekdays) === null || _a === void 0 ? void 0 : _a.length) ? new Set(patch.weekdays) : null;
        let count = 0;
        for (const date of nights) {
            if (weekdays && !weekdays.has(new Date(`${date}T00:00:00`).getDay()))
                continue;
            await this.upsertRoomDay(ctx, variantId, date, patch);
            count++;
        }
        return count;
    }
};
exports.HotelInventoryService = HotelInventoryService;
exports.HotelInventoryService = HotelInventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], HotelInventoryService);
//# sourceMappingURL=hotel-inventory.service.js.map