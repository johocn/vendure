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
exports.StockReservationService = exports.DEFAULT_RESERVATION_TTL_MINUTES = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const stock_reservation_entity_1 = require("./stock-reservation.entity");
const stock_reservation_item_entity_1 = require("./stock-reservation-item.entity");
const virtual_physical_stock_service_1 = require("./virtual-physical-stock.service");
const loggerCtx = 'StockReservationService';
exports.DEFAULT_RESERVATION_TTL_MINUTES = 30;
/**
 * 多仓拆分发货预留单：
 * - reserveOnOrder：下单预占（Order/DeliveryType 归一），建头单 PENDING_ALLOC
 * - allocate：逐仓拆分 item，守恒校验 + 单仓物理 onHand 校验，头→ALLOCATED
 * - fulfillItem：核销/发货（扣物理仓由 Vendure core 在 SALE 时完成），item→DONE，全 DONE→头 DONE
 * - release：取消/退款对称释放，头→RELEASED
 * - reconcileScan：对账 Σ物理 − 虚拟 == ΣPENDING item qty
 *
 * 接线：事件托盘复用 virtual-physical-stock.service 的 StockMovementEvent 链路——
 * ALLOCATION=下单预占、SALE=发货/自提核销、CANCELLATION/RELEASE=取消/退款。
 */
let StockReservationService = class StockReservationService {
    constructor(conn, stockLevelService, virtualPhysicalStockService, stockLedgerService, eventBus) {
        this.conn = conn;
        this.stockLevelService = stockLevelService;
        this.virtualPhysicalStockService = virtualPhysicalStockService;
        this.stockLedgerService = stockLedgerService;
        this.eventBus = eventBus;
    }
    // ---- 基础读写 ----
    repo(ctx) {
        return this.conn.getRepository(ctx, stock_reservation_entity_1.StockReservationEntity);
    }
    itemRepo(ctx) {
        return this.conn.getRepository(ctx, stock_reservation_item_entity_1.StockReservationItemEntity);
    }
    async get(ctx, id) {
        const res = await this.repo(ctx).findOne({ where: { id } });
        if (!res) {
            throw new Error(`预留单不存在: ${id}`);
        }
        return res;
    }
    async findByOrderLine(ctx, orderLineId) {
        return this.repo(ctx).findOne({ where: { orderLineId: Number(orderLineId) } });
    }
    async items(ctx, reservationId) {
        return this.itemRepo(ctx).find({ where: { reservationId } });
    }
    async list(ctx, filters = {}) {
        var _a, _b;
        const qb = this.repo(ctx).createQueryBuilder('r')
            // 括号必需：AND 优先级高于 OR，若不加括号，后续 andWhere 的过滤条件只会作用于
            // 「tenantChannelId IS NULL」那一支，导致本渠道的行永远命中第一个分支、过滤器整体失效。
            .where('(r.tenantChannelId = :tenant OR r.tenantChannelId IS NULL)', { tenant: ctx.channel.code });
        if (filters.status)
            qb.andWhere('r.status = :status', { status: filters.status });
        if (filters.variantId)
            qb.andWhere('r.variantId = :variantId', { variantId: Number(filters.variantId) });
        if (filters.orderId)
            qb.andWhere('r.orderId = :orderId', { orderId: Number(filters.orderId) });
        const page = (_a = filters.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = filters.pageSize) !== null && _b !== void 0 ? _b : 20;
        const [items, totalItems] = await qb
            .orderBy('r.createdAt', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();
        return { items, totalItems };
    }
    // ---- 生命周期 ----
    /** 下单预占：建头单 PENDING_ALLOC（幂等：同一 orderLine+variant 复用）。虚拟 allocation 由 core 下单流程完成，此处仅记账。 */
    async reserveOnOrder(ctx, orderId, orderLineId, variantId, totalQty) {
        const existing = await this.repo(ctx).findOne({
            where: { orderLineId: Number(orderLineId), variantId: Number(variantId) },
        });
        if (existing) {
            existing.totalQty = totalQty;
            existing.status = 'PENDING_ALLOC';
            existing.expiresAt = new Date(Date.now() + (await this.ttlMinutes(ctx)) * 60000);
            return this.repo(ctx).save(existing);
        }
        const res = new stock_reservation_entity_1.StockReservationEntity();
        res.orderId = Number(orderId);
        res.orderLineId = Number(orderLineId);
        res.variantId = Number(variantId);
        res.totalQty = totalQty;
        res.status = 'PENDING_ALLOC';
        res.tenantChannelId = ctx.channel.code;
        res.createdAt = new Date();
        // 到期时间在「建头单」时一次算定，不随后续改配置回溯；TTL 非法/缺失 → 30 分钟
        res.expiresAt = new Date(res.createdAt.getTime() + (await this.ttlMinutes(ctx)) * 60000);
        return this.repo(ctx).save(res);
    }
    /** 备货拆分：重建 item（幂等），守恒校验 Σqty==totalQty、每仓 qty≤物理 onHand，头→ALLOCATED */
    async allocate(ctx, reservationId, splits) {
        const res = await this.get(ctx, reservationId);
        const sum = splits.reduce((s, x) => s + x.qty, 0);
        if (sum !== res.totalQty) {
            throw new Error(`拆分总量(${sum})≠预占(${res.totalQty})`);
        }
        await this.itemRepo(ctx).delete({ reservationId: res.id });
        for (const s of splits) {
            const level = await this.stockLevelService.getStockLevel(ctx, res.variantId, s.locationId);
            if (s.qty > level.stockOnHand) {
                throw new Error(`仓库${s.locationId}物理库存不足(${level.stockOnHand}<${s.qty})`);
            }
            const item = new stock_reservation_item_entity_1.StockReservationItemEntity();
            item.reservationId = res.id;
            item.stockLocationId = Number(s.locationId);
            item.qty = s.qty;
            item.fulfillType = s.fulfillType;
            item.status = 'PENDING';
            await this.itemRepo(ctx).save(item);
        }
        res.status = 'ALLOCATED';
        return this.repo(ctx).save(res);
    }
    /** 出库核销：按核销数量递减 item.qty，清零→DONE；全部 DONE→头 DONE。物理扣减由 core 在 SALE 完成。 */
    async fulfillItem(ctx, itemId, quantity) {
        const item = await this.itemRepo(ctx).findOne({ where: { id: itemId } });
        if (!item) {
            throw new Error(`预留明细不存在: ${itemId}`);
        }
        const qty = quantity !== null && quantity !== void 0 ? quantity : item.qty;
        item.qty = Math.max(0, item.qty - qty);
        if (item.qty <= 0) {
            item.qty = 0;
            item.status = 'DONE';
        }
        const saved = await this.itemRepo(ctx).save(item);
        const pending = await this.itemRepo(ctx).count({ where: { reservationId: item.reservationId, status: 'PENDING' } });
        if (pending === 0) {
            const res = await this.get(ctx, item.reservationId);
            if (res.status !== 'RELEASED') {
                res.status = 'DONE';
                await this.repo(ctx).save(res);
            }
        }
        return saved;
    }
    /** 取消/退款：对称释放。returnPhysical=true 时对已出库 DONE 明细回补物理仓（默认 false，core 的 CANCELLATION/RELEASE 已回补）。 */
    async release(ctx, reservationId, options = {}) {
        const res = await this.get(ctx, reservationId);
        if (res.status === 'RELEASED' || res.status === 'DONE') {
            return res;
        }
        const items = await this.items(ctx, reservationId);
        if (options.returnPhysical) {
            for (const done of items.filter(i => i.status === 'DONE')) {
                await this.virtualPhysicalStockService.adjustPhysicalStock(ctx, res.variantId, done.stockLocationId, done.qty, `预留单释放回补:${res.id}`);
            }
        }
        res.status = 'RELEASED';
        return this.repo(ctx).save(res);
    }
    /** 预留有效期（分钟）：channel customFields.reservationTtlMinutes，非法/缺失 → 30 */
    async ttlMinutes(ctx) {
        var _a, _b;
        const raw = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.reservationTtlMinutes;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? Math.trunc(n) : exports.DEFAULT_RESERVATION_TTL_MINUTES;
    }
    /**
     * 超时释放：只处理 PENDING_ALLOC（下单预占成功但自动拆分未完成的滞留单）。
     * ALLOCATED 不释放 —— 货已按仓拆好等发货，释放会打断履约。
     * expiresAt 为 NULL 的历史单不处理（不回溯）。
     *
     * options.tenantChannelId：显式指定释放范围（按 tenantChannelId 精确收窄），**默认取 ctx 自身渠道**。
     * 调用方（worker 任务）按分组 code 逐个传入，故「渠道已被删除/改名」的存量单也仍能按其原 code 释放，
     * 不会因为反查不到渠道而永久占用库存。
     */
    async releaseExpired(ctx, options = {}) {
        var _a, _b;
        const now = (_a = options.now) !== null && _a !== void 0 ? _a : new Date();
        const limit = (_b = options.limit) !== null && _b !== void 0 ? _b : 200;
        const tenant = options.tenantChannelId === undefined ? ctx.channel.code : options.tenantChannelId;
        const qb = this.repo(ctx)
            .createQueryBuilder('r')
            .where('r.status = :status', { status: 'PENDING_ALLOC' })
            .andWhere('r.expiresAt IS NOT NULL')
            .andWhere('r.expiresAt < :now', { now });
        if (tenant === null) {
            qb.andWhere('r.tenantChannelId IS NULL');
        }
        else {
            qb.andWhere('(r.tenantChannelId = :tenant OR r.tenantChannelId IS NULL)', { tenant });
        }
        const expired = await qb.orderBy('r.expiresAt', 'ASC').take(limit).getMany();
        if (!expired.length) {
            return { scanned: 0, released: 0 };
        }
        for (const res of expired) {
            await this.release(ctx, res.id, { returnPhysical: false });
            await this.recordReleaseLedger(ctx, res);
        }
        core_1.Logger.info(`预留单超时释放 ${expired.length} 单`, loggerCtx);
        return { scanned: expired.length, released: expired.length };
    }
    /**
     * 释放留痕：写一条 OrderStockLedger 事件行。
     * 注意语义：PENDING_ALLOC 无 item、无物理占用，释放**不改变实物 onHand**，
     * 故 reason 显式标注「不改实物库存」；quantity 记的是被释放的占用量，便于对账检索。
     */
    async recordReleaseLedger(ctx, res) {
        var _a;
        // 留痕必须落在该预留单**自己渠道**的账上：渠道被删除/改名后，释放只能借默认渠道 ctx 执行，
        // 此时写流水会把别的渠道的释放记到默认渠道账上（污染对账）→ 跳过并告警。
        // 口径同「无可用仓跳过留痕」：状态照常释放，只跳过流水。
        if (res.tenantChannelId && res.tenantChannelId !== ctx.channel.code) {
            core_1.Logger.warn(`预留单 #${res.id} 属于渠道 ${res.tenantChannelId}（该渠道已不存在），无渠道上下文，跳过流水留痕`, loggerCtx);
            return;
        }
        const ov = await this.virtualPhysicalStockService.getTenantInventoryOverview(ctx);
        const locationId = (_a = ov.defaultPhysicalLocationId) !== null && _a !== void 0 ? _a : ov.virtualLocationId;
        if (!locationId) {
            core_1.Logger.warn(`预留单 #${res.id} 释放时无可用仓，跳过流水留痕`, loggerCtx);
            return;
        }
        await this.stockLedgerService.record(ctx, {
            productVariantId: res.variantId,
            stockLocationId: locationId,
            bizType: 'manual',
            bizCode: `RES-${res.id}`,
            orderLineId: res.orderLineId,
            direction: 'out',
            quantity: res.totalQty,
            reason: `预留单超时释放:#${res.id}（不改实物库存）`,
        });
    }
    // ---- 对账 ----
    /** 对账恒等式：Σ物理 − 虚拟 == ΣPENDING item qty（按变体，渠道内） */
    async reconcileScan(ctx) {
        var _a, _b, _c, _d;
        const pendingItems = await this.itemRepo(ctx).find({ where: { status: 'PENDING' } });
        if (!pendingItems.length) {
            return [];
        }
        const resIds = pendingItems.map(i => i.reservationId);
        const reservations = await this.repo(ctx).find({ where: { id: (0, typeorm_1.In)(resIds) } });
        const tenant = ctx.channel.code;
        const tenanted = reservations.filter(r => r.tenantChannelId == null || r.tenantChannelId === tenant);
        const resById = new Map(tenanted.map(r => [r.id, r]));
        const group = new Map();
        for (const it of pendingItems) {
            const res = resById.get(it.reservationId);
            if (!res) {
                continue;
            }
            const g = (_a = group.get(res.variantId)) !== null && _a !== void 0 ? _a : { variantId: res.variantId, pendingQty: 0 };
            g.pendingQty += it.qty;
            group.set(res.variantId, g);
        }
        if (!group.size) {
            return [];
        }
        const locs = await this.conn.getRepository(ctx, core_1.StockLocation).find({ loadEagerRelations: false });
        const kindByLoc = new Map();
        for (const l of locs) {
            kindByLoc.set(String(l.id), String((_c = (_b = l.customFields) === null || _b === void 0 ? void 0 : _b.kind) !== null && _c !== void 0 ? _c : 'virtual'));
        }
        const diffs = [];
        for (const g of group.values()) {
            const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, g.variantId);
            let physical = 0;
            let virtual = 0;
            for (const lv of levels) {
                const kind = (_d = kindByLoc.get(String(lv.stockLocationId))) !== null && _d !== void 0 ? _d : 'virtual';
                if (kind === 'physical') {
                    physical += lv.stockOnHand;
                }
                else {
                    virtual += lv.stockOnHand;
                }
            }
            diffs.push({
                variantId: g.variantId,
                physicalSum: physical,
                virtualSum: virtual,
                pendingQty: g.pendingQty,
                diff: physical - virtual - g.pendingQty,
            });
        }
        return diffs;
    }
    // ---- 事件接线（复用 StockMovementEvent 托盘） ----
    registerOrderHandlers() {
        this.eventBus.ofType(core_1.StockMovementEvent).subscribe(async (event) => {
            var _a, _b;
            const movements = (_a = event.stockMovements) !== null && _a !== void 0 ? _a : [];
            const type = (_b = movements[0]) === null || _b === void 0 ? void 0 : _b.type;
            try {
                if (type === 'ALLOCATION') {
                    await this.onAllocation(event.ctx, movements);
                }
                else if (type === 'SALE') {
                    await this.onSale(event.ctx, movements);
                }
                else if (type === 'CANCELLATION' || type === 'RELEASE') {
                    await this.onRelease(event.ctx, movements);
                }
            }
            catch (e) {
                core_1.Logger.warn(`预留单事件处理失败(${type}): ${e.message}`, loggerCtx);
            }
        });
    }
    /** ALLOCATION=下单预占：按 orderLine 聚合成头单 + 逐仓拆分（配送方式决定 fulfillType） */
    async onAllocation(ctx, movements) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const groups = new Map();
        for (const m of movements) {
            const lineId = String((_b = (_a = m.orderLine) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '');
            if (!lineId) {
                continue;
            }
            const list = (_c = groups.get(lineId)) !== null && _c !== void 0 ? _c : [];
            list.push(m);
            groups.set(lineId, list);
        }
        for (const [lineId, allocs] of groups.entries()) {
            try {
                const orderLine = await this.conn.getRepository(ctx, core_1.OrderLine).findOne({
                    where: { id: Number(lineId) },
                    relations: ['order'],
                });
                if (!orderLine) {
                    continue;
                }
                const variantId = (_e = (_d = allocs[0].productVariant) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : allocs[0].productVariantId;
                const totalQty = allocs.reduce((s, a) => s + a.quantity, 0);
                const orderId = (_g = (_f = orderLine.order) === null || _f === void 0 ? void 0 : _f.id) !== null && _g !== void 0 ? _g : allocs[0].orderId;
                if (variantId == null) {
                    continue;
                }
                const res = await this.reserveOnOrder(ctx, orderId, lineId, variantId, totalQty);
                const deliveryType = (_j = (_h = orderLine.order) === null || _h === void 0 ? void 0 : _h.customFields) === null || _j === void 0 ? void 0 : _j.deliveryType;
                const fulfillType = deliveryType === 'pickup' ? 'CLICK_COLLECT' : 'SHIP';
                const splits = allocs.map(a => ({
                    locationId: a.stockLocationId,
                    fulfillType,
                    qty: a.quantity,
                }));
                await this.allocate(ctx, res.id, splits);
            }
            catch (e) {
                core_1.Logger.warn(`下单预留失败(orderLine=${lineId}): ${e.message}`, loggerCtx);
            }
        }
    }
    /** SALE=发货/自提核销：按 orderLine+location 命中预留明细并核销（物理扣减 core 已完成，仅记账） */
    async onSale(ctx, movements) {
        var _a, _b, _c;
        for (const sale of movements) {
            try {
                const lineId = String((_b = (_a = sale.orderLine) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '');
                const locId = sale.stockLocationId;
                const qty = Math.abs((_c = sale.quantity) !== null && _c !== void 0 ? _c : 0);
                if (!lineId || locId == null || qty === 0) {
                    continue;
                }
                const res = await this.findByOrderLine(ctx, lineId);
                if (!res) {
                    continue;
                }
                const item = await this.itemRepo(ctx).findOne({
                    where: { reservationId: res.id, stockLocationId: Number(locId), status: 'PENDING' },
                });
                if (!item) {
                    continue;
                }
                await this.fulfillItem(ctx, item.id, qty);
            }
            catch (e) {
                core_1.Logger.warn(`发货核销预留失败: ${e.message}`, loggerCtx);
            }
        }
    }
    /** CANCELLATION/RELEASE=取消/退款：头单对称释放 */
    async onRelease(ctx, movements) {
        const lineIds = new Set();
        movements.forEach(m => {
            var _a, _b;
            const id = String((_b = (_a = m.orderLine) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '');
            if (id) {
                lineIds.add(id);
            }
        });
        for (const lineId of lineIds) {
            try {
                const res = await this.findByOrderLine(ctx, lineId);
                if (!res) {
                    continue;
                }
                await this.release(ctx, res.id, { returnPhysical: false });
            }
            catch (e) {
                core_1.Logger.warn(`取消释放预留失败(orderLine=${lineId}): ${e.message}`, loggerCtx);
            }
        }
    }
};
exports.StockReservationService = StockReservationService;
exports.StockReservationService = StockReservationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.StockLevelService,
        virtual_physical_stock_service_1.VirtualPhysicalStockService,
        inventory_plugin_1.StockLedgerService,
        core_1.EventBus])
], StockReservationService);
//# sourceMappingURL=stock-reservation.service.js.map