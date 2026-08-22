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
exports.InventoryService = void 0;
// e:\code\vendure\packages\inventory-plugin\src\inventory.service.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const stock_in_order_entity_1 = require("./entities/stock-in-order.entity");
const stock_out_order_entity_1 = require("./entities/stock-out-order.entity");
const stock_move_order_entity_1 = require("./entities/stock-move-order.entity");
const stocktake_order_entity_1 = require("./entities/stocktake-order.entity");
const supplier_entity_1 = require("./entities/supplier.entity");
const purchase_order_entity_1 = require("./entities/purchase-order.entity");
const stock_ledger_service_1 = require("./stock-ledger.service");
const loggerCtx = 'InventoryService';
let InventoryService = class InventoryService {
    constructor(connection, stockMovementService, stockLevelService, stockLocationService, stockLedgerService) {
        this.connection = connection;
        this.stockMovementService = stockMovementService;
        this.stockLevelService = stockLevelService;
        this.stockLocationService = stockLocationService;
        this.stockLedgerService = stockLedgerService;
    }
    // ===== 内部辅助方法 =====
    /**
     * 调整某仓库的库存（delta 为正数表示增加，负数表示减少）
     * 通过 adjustProductVariantStock 写入 StockAdjustment 流水
     * 在 customFields.businessReason 记录业务来源（无需二次查询）
     */
    async adjustStockForLocation(ctx, variantId, locationId, delta, reason, meta) {
        var _a;
        const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const beforeOnHand = current.stockOnHand;
        const newOnHand = beforeOnHand + delta;
        const adjustments = await this.stockMovementService.adjustProductVariantStock(ctx, variantId, [{ stockLocationId: locationId, stockOnHand: newOnHand }]);
        // 直接写入 customFields.businessReason
        const adjustmentRepo = this.connection.getRepository(ctx, core_1.StockAdjustment);
        for (const adj of adjustments) {
            adj.customFields = Object.assign(Object.assign({}, ((_a = adj.customFields) !== null && _a !== void 0 ? _a : {})), { businessReason: reason });
            await adjustmentRepo.save(adj);
        }
        // 供销存账本：真实 onHand 变动，同事务写一条
        if (meta) {
            const ledgerInput = {
                productVariantId: variantId,
                stockLocationId: locationId,
                bizType: meta.bizType,
                bizCode: meta.bizCode,
                orderLineId: meta.orderLineId,
                otherLocationId: meta.otherLocationId,
                quantity: delta,
                beforeOnHand,
                afterOnHand: newOnHand,
                reason,
            };
            await this.stockLedgerService.record(ctx, ledgerInput);
        }
        core_1.Logger.info(`Stock adjusted: variant=${variantId} location=${locationId} delta=${delta} reason=${reason}`, loggerCtx);
    }
    /**
     * 手工校准某仓可变体库存为指定绝对数量（delta = 目标 - 当前，写 manual 账本便于追溯）。
     * delta 为 0 时不写任何流水。
     */
    async setStockForVariant(ctx, variantId, locationId, stockOnHand, reason = 'manual-adjust') {
        const delta = stockOnHand - (await this.stockLevelService.getStockLevel(ctx, variantId, locationId)).stockOnHand;
        if (delta === 0) {
            return;
        }
        await this.adjustStockForLocation(ctx, variantId, locationId, delta, reason, {
            bizType: 'manual',
            bizCode: `MAN-${variantId}`,
        });
    }
    /**
     * 售后退货回补：将收到的退货回补到原发货仓，同一事务内写 afterSales 账本。
     * 供 after-sales-plugin 在 confirmReceive（Returning→Received）时调用。
     * @param quantity 正数表示回补数量（= min(订单行数量, 实收数量)）
     */
    async applyAfterSalesRestock(ctx, variantId, locationId, quantity, afterSalesCode, orderLineId) {
        await this.adjustStockForLocation(ctx, variantId, locationId, +quantity, `AfterSales#${afterSalesCode}:return-restock`, { bizType: 'afterSales', bizCode: afterSalesCode, orderLineId });
    }
    /**
     * 售后退货多仓按包回补：按 orderLine 的 Allocation 记录（各仓实际发货量）将退货按比例回补到各仓。
     * - 单仓 → 退化现有 applyAfterSalesRestock（回补该仓）
     * - 多仓 → 最大余数法整数分配，逐仓 adjustStockForLocation 写 afterSales:in 账本
     * - 兜底：查不到 Allocation → 回退 orderLine.customFields.stockLocationId 单仓（现状行为）
     * @returns 各仓回补明细 [{ stockLocationId, quantity }]（供 restockJson 留痕）
     */
    async applyAfterSalesRestockMulti(ctx, orderLineId, quantity, afterSalesCode) {
        var _a, _b, _c;
        // 1. 取订单行 + variant
        const orderLine = await this.connection.getRepository(ctx, core_1.OrderLine).findOne({
            where: { id: orderLineId },
        });
        if (!orderLine) {
            throw new core_1.UserInputError(`OrderLine not found: ${orderLineId}`);
        }
        const variantId = orderLine.productVariantId;
        // 2. 按仓分组求和（Allocation 记录为各仓实际发货量，取绝对值）
        //    注意：不能按 Sale 分组 —— core 的 createSalesForOrder 每条 Sale 都记整行数量
        const allocations = await this.connection.getRepository(ctx, core_1.Allocation).find({
            where: { orderLine: { id: orderLineId } },
        });
        const shippedByLoc = new Map();
        for (const a of allocations) {
            const locId = String(a.stockLocationId);
            if (!locId)
                continue;
            shippedByLoc.set(locId, ((_a = shippedByLoc.get(locId)) !== null && _a !== void 0 ? _a : 0) + Math.abs(Number(a.quantity) || 0));
        }
        // 3. 兜底：查不到 Allocation → 回退 orderLine.customFields.stockLocationId 单仓（现状行为）
        if (shippedByLoc.size === 0) {
            const fallbackLoc = (_c = (_b = orderLine.customFields) === null || _b === void 0 ? void 0 : _b.stockLocationId) !== null && _c !== void 0 ? _c : null;
            if (fallbackLoc != null && quantity > 0) {
                await this.applyAfterSalesRestock(ctx, variantId, fallbackLoc, quantity, afterSalesCode, orderLineId);
                return [{ stockLocationId: fallbackLoc, quantity: +quantity }];
            }
            core_1.Logger.warn(`applyAfterSalesRestockMulti: orderLine ${orderLineId} 无 Allocation 亦无 stockLocationId，跳过回补`, loggerCtx);
            return [];
        }
        // 4. 单仓 → 退化现有 applyAfterSalesRestock
        if (shippedByLoc.size === 1) {
            const [locId] = [...shippedByLoc.keys()];
            await this.applyAfterSalesRestock(ctx, variantId, locId, quantity, afterSalesCode, orderLineId);
            return [{ stockLocationId: locId, quantity: +quantity }];
        }
        // 5. 多仓 → 最大余数法整数分配（保证 Σ=quantity 且非负整数）
        const totalShipped = [...shippedByLoc.values()].reduce((s, v) => s + v, 0);
        const entries = [...shippedByLoc.entries()].map(([locId, shipped]) => {
            const exact = (quantity * shipped) / totalShipped;
            const floor = Math.floor(exact);
            return { locId, shipped, floor, remainder: exact - floor };
        });
        // 余数从大到小排序，余数相同取发货量大者优先
        entries.sort((a, b) => b.remainder - a.remainder || b.shipped - a.shipped);
        let remaining = quantity - entries.reduce((s, e) => s + e.floor, 0);
        for (const e of entries) {
            if (remaining <= 0)
                break;
            e.floor += 1;
            remaining -= 1;
        }
        // 6. 逐仓回补 + 落账本
        const detail = [];
        for (const e of entries) {
            if (e.floor <= 0)
                continue;
            await this.adjustStockForLocation(ctx, variantId, e.locId, e.floor, `AfterSales#${afterSalesCode}:return-restock`, { bizType: 'afterSales', bizCode: afterSalesCode, orderLineId });
            detail.push({ stockLocationId: e.locId, quantity: e.floor });
        }
        return detail;
    }
    /**
     * 订单发货记账：core 在 Fulfillment Created→Pending 时创建 Sale 流水（真实扣减 onHand），
     * 本方法在同一事务内为该批 Sale 写入 order:out 账本，保证账实一致（账本口径铁律：只记真实 onHand 变动，
     * 占货 ALLOCATION 不记、超时取消 RELEASE 不记）。
     * 由 inventory.plugin.ts 注册的 StockMovementEvent(SALE) 阻塞事件处理器调用。
     */
    async recordOrderSalesOut(ctx, sales) {
        var _a, _b, _c, _d, _e, _f, _g;
        for (const sale of sales) {
            const orderLineId = (_a = sale.orderLine) === null || _a === void 0 ? void 0 : _a.id;
            if (orderLineId == null) {
                continue;
            }
            const variantId = (_b = sale.productVariant) === null || _b === void 0 ? void 0 : _b.id;
            const locationId = (_c = sale.stockLocationId) !== null && _c !== void 0 ? _c : (_d = sale.stockLocation) === null || _d === void 0 ? void 0 : _d.id;
            if (variantId == null || locationId == null) {
                core_1.Logger.warn(`Ledger order:out skipped (missing variant/location): orderLine=${orderLineId}`, loggerCtx);
                continue;
            }
            // bizCode 取订单号，便于按单一站式追溯
            let orderCode = `OL${orderLineId}`;
            // 拆单/多仓时 Sale.quantity 为整行数量（上游 Vendure 行为，每仓各记整行），
            // 本仓真实扣减量以订单行 Allocation 记录为准（逐仓数量），单仓时回退整行数量。
            let soldQty = Math.abs(sale.quantity);
            try {
                const orderLine = await this.connection.getRepository(ctx, core_1.OrderLine).findOne({
                    where: { id: orderLineId },
                    relations: ['order'],
                });
                orderCode = (_f = (_e = orderLine === null || orderLine === void 0 ? void 0 : orderLine.order) === null || _e === void 0 ? void 0 : _e.code) !== null && _f !== void 0 ? _f : orderCode;
                const perLocation = await this.connection.getRepository(ctx, core_1.Allocation).find({
                    where: { orderLine: { id: orderLineId } },
                });
                const allocForLoc = perLocation.find(a => (0, core_1.idsAreEqual)(a.stockLocationId, locationId));
                if (allocForLoc != null && allocForLoc.quantity != null) {
                    soldQty = Math.abs(allocForLoc.quantity);
                }
            }
            catch (e) {
                core_1.Logger.warn(`Ledger order:out order-code lookup failed: ${(_g = e === null || e === void 0 ? void 0 : e.message) !== null && _g !== void 0 ? _g : e}`, loggerCtx);
            }
            // publish 发生在扣库之后，读取当前 onHand 作为 afterOnHand 快照（sale.quantity 为负数）
            let beforeOnHand;
            let afterOnHand;
            try {
                afterOnHand = (await this.stockLevelService.getStockLevel(ctx, variantId, locationId)).stockOnHand;
                beforeOnHand = afterOnHand + soldQty;
            }
            catch (_h) {
                /* 快照失败不阻断记账 */
            }
            await this.stockLedgerService.record(ctx, {
                productVariantId: variantId,
                stockLocationId: locationId,
                bizType: 'order',
                bizCode: orderCode,
                orderLineId,
                direction: 'out',
                quantity: soldQty,
                beforeOnHand,
                afterOnHand,
                reason: `Order#${orderCode}:sale`,
            });
        }
    }
    /**
     * 校验源仓库存是否充足（available = stockOnHand - stockAllocated）
     */
    async assertSufficientStock(ctx, variantId, locationId, requiredQty) {
        const level = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const available = level.stockOnHand - level.stockAllocated;
        if (available < requiredQty) {
            throw new core_1.UserInputError(`Insufficient stock for variant ${variantId} at location ${locationId}: ` +
                `required ${requiredQty}, available ${available}`);
        }
    }
    /**
     * 状态转换校验
     */
    assertTransition(order, fromState, toState, transitions) {
        var _a;
        if (order.state !== fromState) {
            throw new core_1.UserInputError(`Invalid state: expected ${fromState}, got ${order.state}`);
        }
        const allowed = (_a = transitions[fromState]) !== null && _a !== void 0 ? _a : [];
        if (!allowed.includes(toState)) {
            throw new core_1.UserInputError(`Invalid transition: ${fromState} -> ${toState}`);
        }
    }
    /**
     * 生成业务单号（前缀 + 时间戳 + 随机数）
     */
    generateCode(prefix) {
        const now = new Date();
        const ts = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${prefix}${ts}${rand}`;
    }
    // ===== 库存查询 =====
    async findStockLevels(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const repo = this.connection.getRepository(ctx, core_1.StockLevel);
        const qb = repo.createQueryBuilder('level')
            .leftJoinAndSelect('level.productVariant', 'variant')
            .leftJoinAndSelect('level.stockLocation', 'location');
        if (options === null || options === void 0 ? void 0 : options.locationId) {
            qb.andWhere('level.stockLocationId = :locationId', { locationId: options.locationId });
        }
        qb.orderBy('level.productVariantId', 'ASC')
            .skip((page - 1) * pageSize)
            .take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findStockMovements(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const repo = this.connection.rawConnection.getRepository('StockMovement');
        const qb = repo.createQueryBuilder('movement')
            .leftJoinAndSelect('movement.productVariant', 'variant')
            .leftJoinAndSelect('movement.stockLocation', 'location')
            .orderBy('movement.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.productVariantId) {
            qb.andWhere('movement.productVariantId = :variantId', { variantId: options.productVariantId });
        }
        if (options === null || options === void 0 ? void 0 : options.locationId) {
            qb.andWhere('movement.stockLocationId = :locationId', { locationId: options.locationId });
        }
        if (options === null || options === void 0 ? void 0 : options.type) {
            qb.andWhere('movement.type = :type', { type: options.type });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findStockLocations(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const result = await this.stockLocationService.findAll(ctx, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return { items: result.items, totalItems: result.totalItems };
    }
    async findStockLedger(ctx, options) {
        return this.stockLedgerService.list(ctx, options);
    }
    // ===== 多库库存展示 =====
    /**
     * 多库库存展示（就近门店库存）：返回某商品在各仓库/门店的逐仓可售库存 + 距离。
     * - productId 必填；variantId 省略时返回该商品全部 variant。
     * - 带 lat/lng 时按距离升序排序（无坐标为 -1 排末尾）；带 city 时仅保留服务该城市的仓。
     */
    async findNearbyStock(ctx, options) {
        // 分页拉取全部仓库（单次列表查询有上限，避免 take 超限报错）
        const pageSize = 100;
        const locations = [];
        let page = 1;
        while (true) {
            const result = await this.stockLocationService.findAll(ctx, {
                skip: (page - 1) * pageSize,
                take: pageSize,
            });
            locations.push(...result.items);
            if (result.items.length < pageSize || result.totalItems <= locations.length) {
                break;
            }
            page++;
        }
        const variantRepo = this.connection.getRepository(ctx, core_1.ProductVariant);
        const variants = await variantRepo.find({
            where: options.variantId
                ? { id: options.variantId }
                : { product: { id: options.productId } },
            relations: ['product'],
        });
        const origin = options.lat != null && options.lng != null
            ? { lat: options.lat, lng: options.lng }
            : null;
        const rows = [];
        for (const loc of locations) {
            if (options.city && !this.locationServesCity(loc, options.city)) {
                continue;
            }
            const distanceKm = this.locationDistanceKm(loc, origin);
            const perLocation = [];
            for (const v of variants) {
                const level = await this.stockLevelService.getStockLevel(ctx, v.id, loc.id);
                perLocation.push({
                    variantId: v.id,
                    variantName: v.name,
                    sku: v.sku,
                    stockOnHand: level.stockOnHand,
                    stockAllocated: level.stockAllocated,
                    stockAvailable: level.stockOnHand - level.stockAllocated,
                });
            }
            rows.push({ location: loc, distanceKm, variants: perLocation });
        }
        // 带定位：距离升序（无坐标为 MAX 排末尾）；无定位：保持原顺序
        rows.sort((a, b) => a.distanceKm - b.distanceKm);
        return rows;
    }
    locationServesCity(loc, city) {
        var _a;
        const serviceCities = (_a = loc.customFields) === null || _a === void 0 ? void 0 : _a.serviceCities;
        if (!Array.isArray(serviceCities) || serviceCities.length === 0) {
            return true;
        }
        return serviceCities.includes(city);
    }
    locationDistanceKm(loc, origin) {
        var _a;
        if (!origin)
            return -1;
        const cf = (_a = loc.customFields) !== null && _a !== void 0 ? _a : {};
        const lat = cf.lat != null ? Number(cf.lat) : NaN;
        const lng = cf.lng != null ? Number(cf.lng) : NaN;
        if (!isFinite(lat) || !isFinite(lng))
            return Number.MAX_SAFE_INTEGER;
        return this.haversineKm(origin.lat, origin.lng, lat, lng);
    }
    haversineKm(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }
    // ===== 入库单 =====
    async createStockInOrder(ctx, input) {
        const order = new stock_in_order_entity_1.StockInOrder({
            code: this.generateCode('RKT'),
            state: constants_1.StockInState.Pending,
            type: input.type,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            targetLocationId: input.targetLocationId,
        });
        order.lines = input.lines.map(l => {
            var _a;
            return new stock_in_order_entity_1.StockInOrderLine({
                productVariantId: l.productVariantId,
                quantity: l.quantity,
                unitPrice: (_a = l.unitPrice) !== null && _a !== void 0 ? _a : null,
            });
        });
        const repo = this.connection.getRepository(ctx, stock_in_order_entity_1.StockInOrder);
        return repo.save(order);
    }
    async findStockInOrders(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const repo = this.connection.getRepository(ctx, stock_in_order_entity_1.StockInOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.targetLocation', 'targetLocation')
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneStockInOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stock_in_order_entity_1.StockInOrder);
        return repo.findOne({
            where: { id: id },
            relations: ['lines', 'targetLocation'],
        });
    }
    async completeStockInOrder(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stock_in_order_entity_1.StockInOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StockInOrder ${id} not found`);
            this.assertTransition(order, constants_1.StockInState.Pending, constants_1.StockInState.Completed, constants_1.STOCK_IN_TRANSITIONS);
            for (const line of order.lines) {
                await this.adjustStockForLocation(txCtx, line.productVariantId, order.targetLocationId, line.quantity, `StockInOrder#${order.code}:inbound`, { bizType: 'stockIn', bizCode: order.code });
            }
            order.state = constants_1.StockInState.Completed;
            order.completedAt = new Date();
            return repo.save(order);
        });
    }
    async cancelStockInOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stock_in_order_entity_1.StockInOrder);
        const order = await repo.findOne({ where: { id: id } });
        if (!order)
            throw new core_1.UserInputError(`StockInOrder ${id} not found`);
        this.assertTransition(order, constants_1.StockInState.Pending, constants_1.StockInState.Cancelled, constants_1.STOCK_IN_TRANSITIONS);
        order.state = constants_1.StockInState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }
    // ===== 出库单 =====
    async createStockOutOrder(ctx, input) {
        const order = new stock_out_order_entity_1.StockOutOrder({
            code: this.generateCode('CKT'),
            state: constants_1.StockOutState.Pending,
            type: input.type,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            sourceLocationId: input.sourceLocationId,
        });
        order.lines = input.lines.map(l => {
            var _a;
            return new stock_out_order_entity_1.StockOutOrderLine({
                productVariantId: l.productVariantId,
                quantity: l.quantity,
                unitPrice: (_a = l.unitPrice) !== null && _a !== void 0 ? _a : null,
            });
        });
        const repo = this.connection.getRepository(ctx, stock_out_order_entity_1.StockOutOrder);
        return repo.save(order);
    }
    async findStockOutOrders(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const repo = this.connection.getRepository(ctx, stock_out_order_entity_1.StockOutOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.sourceLocation', 'sourceLocation')
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneStockOutOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stock_out_order_entity_1.StockOutOrder);
        return repo.findOne({
            where: { id: id },
            relations: ['lines', 'sourceLocation'],
        });
    }
    async completeStockOutOrder(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stock_out_order_entity_1.StockOutOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StockOutOrder ${id} not found`);
            this.assertTransition(order, constants_1.StockOutState.Pending, constants_1.StockOutState.Completed, constants_1.STOCK_OUT_TRANSITIONS);
            // 1. 校验源仓库存充足
            for (const line of order.lines) {
                await this.assertSufficientStock(txCtx, line.productVariantId, order.sourceLocationId, line.quantity);
            }
            // 2. 扣减库存
            for (const line of order.lines) {
                await this.adjustStockForLocation(txCtx, line.productVariantId, order.sourceLocationId, -line.quantity, `StockOutOrder#${order.code}:outbound`, { bizType: 'stockOut', bizCode: order.code });
            }
            order.state = constants_1.StockOutState.Completed;
            order.completedAt = new Date();
            return repo.save(order);
        });
    }
    async cancelStockOutOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stock_out_order_entity_1.StockOutOrder);
        const order = await repo.findOne({ where: { id: id } });
        if (!order)
            throw new core_1.UserInputError(`StockOutOrder ${id} not found`);
        this.assertTransition(order, constants_1.StockOutState.Pending, constants_1.StockOutState.Cancelled, constants_1.STOCK_OUT_TRANSITIONS);
        order.state = constants_1.StockOutState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }
    // ===== 调拨单 =====
    async createStockMoveOrder(ctx, input) {
        if (String(input.sourceLocationId) === String(input.targetLocationId)) {
            throw new core_1.UserInputError('Source and target locations cannot be the same');
        }
        const order = new stock_move_order_entity_1.StockMoveOrder({
            code: this.generateCode('DBT'),
            state: constants_1.StockMoveState.Pending,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            sourceLocationId: input.sourceLocationId,
            targetLocationId: input.targetLocationId,
        });
        order.lines = input.lines.map(l => new stock_move_order_entity_1.StockMoveOrderLine({
            productVariantId: l.productVariantId,
            quantity: l.quantity,
        }));
        const repo = this.connection.getRepository(ctx, stock_move_order_entity_1.StockMoveOrder);
        return repo.save(order);
    }
    async findStockMoveOrders(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const repo = this.connection.getRepository(ctx, stock_move_order_entity_1.StockMoveOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.sourceLocation', 'sourceLocation')
            .leftJoinAndSelect('order.targetLocation', 'targetLocation')
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneStockMoveOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stock_move_order_entity_1.StockMoveOrder);
        return repo.findOne({
            where: { id: id },
            relations: ['lines', 'sourceLocation', 'targetLocation'],
        });
    }
    /**
     * Pending → InTransit：源仓出库（扣减）
     */
    async shipStockMoveOrder(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stock_move_order_entity_1.StockMoveOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StockMoveOrder ${id} not found`);
            this.assertTransition(order, constants_1.StockMoveState.Pending, constants_1.StockMoveState.InTransit, constants_1.STOCK_MOVE_TRANSITIONS);
            for (const line of order.lines) {
                await this.assertSufficientStock(txCtx, line.productVariantId, order.sourceLocationId, line.quantity);
            }
            for (const line of order.lines) {
                await this.adjustStockForLocation(txCtx, line.productVariantId, order.sourceLocationId, -line.quantity, `StockMoveOrder#${order.code}:source-out`, { bizType: 'stockMove', bizCode: order.code, otherLocationId: order.targetLocationId });
            }
            order.state = constants_1.StockMoveState.InTransit;
            order.shippedAt = new Date();
            return repo.save(order);
        });
    }
    /**
     * InTransit → Received：目的仓入库（增加）
     */
    async receiveStockMoveOrder(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stock_move_order_entity_1.StockMoveOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StockMoveOrder ${id} not found`);
            this.assertTransition(order, constants_1.StockMoveState.InTransit, constants_1.StockMoveState.Received, constants_1.STOCK_MOVE_TRANSITIONS);
            for (const line of order.lines) {
                await this.adjustStockForLocation(txCtx, line.productVariantId, order.targetLocationId, +line.quantity, `StockMoveOrder#${order.code}:target-in`, { bizType: 'stockMove', bizCode: order.code, otherLocationId: order.sourceLocationId });
            }
            order.state = constants_1.StockMoveState.Received;
            order.receivedAt = new Date();
            return repo.save(order);
        });
    }
    /**
     * Received → Completed：仅状态变更
     */
    async completeStockMoveOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stock_move_order_entity_1.StockMoveOrder);
        const order = await repo.findOne({ where: { id: id } });
        if (!order)
            throw new core_1.UserInputError(`StockMoveOrder ${id} not found`);
        this.assertTransition(order, constants_1.StockMoveState.Received, constants_1.StockMoveState.Completed, constants_1.STOCK_MOVE_TRANSITIONS);
        order.state = constants_1.StockMoveState.Completed;
        order.completedAt = new Date();
        return repo.save(order);
    }
    /**
     * Pending/InTransit → Cancelled
     * - Pending 态：无库存操作
     * - InTransit 态：回滚源仓（加回去）
     */
    async cancelStockMoveOrder(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stock_move_order_entity_1.StockMoveOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StockMoveOrder ${id} not found`);
            if (![constants_1.StockMoveState.Pending, constants_1.StockMoveState.InTransit].includes(order.state)) {
                throw new core_1.UserInputError(`Cannot cancel stock move order in state: ${order.state}`);
            }
            if (order.state === constants_1.StockMoveState.InTransit) {
                for (const line of order.lines) {
                    await this.adjustStockForLocation(txCtx, line.productVariantId, order.sourceLocationId, +line.quantity, `StockMoveOrder#${order.code}:rollback-source`, { bizType: 'stockMove', bizCode: order.code, otherLocationId: order.targetLocationId });
                }
            }
            order.state = constants_1.StockMoveState.Cancelled;
            order.cancelledAt = new Date();
            return repo.save(order);
        });
    }
    // ===== 盘点单 =====
    async createStocktakeOrder(ctx, input) {
        const order = new stocktake_order_entity_1.StocktakeOrder({
            code: this.generateCode('PDT'),
            state: constants_1.StocktakeState.Pending,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            locationId: input.locationId,
        });
        order.lines = input.productVariantIds.map(vid => new stocktake_order_entity_1.StocktakeOrderLine({
            productVariantId: vid,
            systemQuantity: 0,
            countedQuantity: 0,
            difference: 0,
            reconciled: false,
        }));
        const repo = this.connection.getRepository(ctx, stocktake_order_entity_1.StocktakeOrder);
        return repo.save(order);
    }
    async findStocktakeOrders(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const repo = this.connection.getRepository(ctx, stocktake_order_entity_1.StocktakeOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.location', 'location')
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneStocktakeOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stocktake_order_entity_1.StocktakeOrder);
        return repo.findOne({
            where: { id: id },
            relations: ['lines', 'location'],
        });
    }
    /**
     * Pending → Counting：快照 systemQuantity
     */
    async startCountingStocktake(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stocktake_order_entity_1.StocktakeOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StocktakeOrder ${id} not found`);
            this.assertTransition(order, constants_1.StocktakeState.Pending, constants_1.StocktakeState.Counting, constants_1.STOCKTAKE_TRANSITIONS);
            for (const line of order.lines) {
                const level = await this.stockLevelService.getStockLevel(txCtx, line.productVariantId, order.locationId);
                line.systemQuantity = level.stockOnHand;
            }
            order.state = constants_1.StocktakeState.Counting;
            order.countingStartedAt = new Date();
            return repo.save(order);
        });
    }
    /**
     * Counting → Reconciling：录入 countedQuantity，计算 difference
     */
    async submitStocktakeCount(ctx, id, counts) {
        const repo = this.connection.getRepository(ctx, stocktake_order_entity_1.StocktakeOrder);
        const order = await repo.findOne({
            where: { id: id },
            relations: ['lines'],
        });
        if (!order)
            throw new core_1.UserInputError(`StocktakeOrder ${id} not found`);
        this.assertTransition(order, constants_1.StocktakeState.Counting, constants_1.StocktakeState.Reconciling, constants_1.STOCKTAKE_TRANSITIONS);
        for (const count of counts) {
            const line = order.lines.find(l => String(l.id) === String(count.lineId));
            if (!line)
                throw new core_1.UserInputError(`Line ${count.lineId} not found in order ${id}`);
            line.countedQuantity = count.countedQuantity;
            line.difference = count.countedQuantity - line.systemQuantity;
        }
        order.state = constants_1.StocktakeState.Reconciling;
        order.reconcilingStartedAt = new Date();
        return repo.save(order);
    }
    /**
     * 审核单行（标记 reconciled = true）
     */
    async reconcileStocktakeLine(ctx, orderId, lineId) {
        const repo = this.connection.getRepository(ctx, stocktake_order_entity_1.StocktakeOrder);
        const order = await repo.findOne({
            where: { id: orderId },
            relations: ['lines'],
        });
        if (!order)
            throw new core_1.UserInputError(`StocktakeOrder ${orderId} not found`);
        if (order.state !== constants_1.StocktakeState.Reconciling) {
            throw new core_1.UserInputError(`Cannot reconcile line in state: ${order.state}`);
        }
        const line = order.lines.find(l => String(l.id) === String(lineId));
        if (!line)
            throw new core_1.UserInputError(`Line ${lineId} not found in order ${orderId}`);
        line.reconciled = true;
        return repo.save(order);
    }
    /**
     * Reconciling → Completed：对每行 reconciled=true 的行应用差异调整
     */
    async completeStocktakeOrder(ctx, id) {
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, stocktake_order_entity_1.StocktakeOrder);
            const order = await repo.findOne({
                where: { id: id },
                relations: ['lines'],
            });
            if (!order)
                throw new core_1.UserInputError(`StocktakeOrder ${id} not found`);
            this.assertTransition(order, constants_1.StocktakeState.Reconciling, constants_1.StocktakeState.Completed, constants_1.STOCKTAKE_TRANSITIONS);
            const unReconciled = order.lines.filter(l => !l.reconciled);
            if (unReconciled.length > 0) {
                throw new core_1.UserInputError(`${unReconciled.length} lines not reconciled`);
            }
            for (const line of order.lines) {
                if (line.difference !== 0) {
                    await this.adjustStockForLocation(txCtx, line.productVariantId, order.locationId, line.difference, `StocktakeOrder#${order.code}:reconcile`, { bizType: 'stocktake', bizCode: order.code });
                }
            }
            order.state = constants_1.StocktakeState.Completed;
            order.completedAt = new Date();
            return repo.save(order);
        });
    }
    async cancelStocktakeOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, stocktake_order_entity_1.StocktakeOrder);
        const order = await repo.findOne({ where: { id: id } });
        if (!order)
            throw new core_1.UserInputError(`StocktakeOrder ${id} not found`);
        if (![constants_1.StocktakeState.Pending, constants_1.StocktakeState.Counting].includes(order.state)) {
            throw new core_1.UserInputError(`Cannot cancel stocktake order in state: ${order.state}`);
        }
        order.state = constants_1.StocktakeState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }
    // ===== 供应商档案 =====
    async assertSupplierCodeUnique(ctx, code, excludeId) {
        const repo = this.connection.getRepository(ctx, supplier_entity_1.Supplier);
        const existing = await repo.createQueryBuilder('s')
            .andWhere('s.code = :code', { code })
            .andWhere(excludeId ? 's.id != :excludeId' : '1=1', excludeId ? { excludeId } : {})
            .getOne();
        if (existing) {
            throw new core_1.UserInputError(`Supplier code already exists: ${code}`);
        }
    }
    async createSupplier(ctx, input) {
        var _a, _b, _c, _d, _e, _f;
        if (!input.code || !input.name) {
            throw new core_1.UserInputError('Supplier code and name are required');
        }
        await this.assertSupplierCodeUnique(ctx, input.code);
        const supplier = new supplier_entity_1.Supplier({
            code: input.code,
            name: input.name,
            taxNumber: (_a = input.taxNumber) !== null && _a !== void 0 ? _a : null,
            contactName: (_b = input.contactName) !== null && _b !== void 0 ? _b : null,
            contactPhone: (_c = input.contactPhone) !== null && _c !== void 0 ? _c : null,
            address: (_d = input.address) !== null && _d !== void 0 ? _d : null,
            settlementDays: (_e = input.settlementDays) !== null && _e !== void 0 ? _e : 0,
            note: (_f = input.note) !== null && _f !== void 0 ? _f : null,
            channelId: ctx.channelId,
        });
        supplier.channels = [ctx.channel];
        return this.connection.getRepository(ctx, supplier_entity_1.Supplier).save(supplier);
    }
    async updateSupplier(ctx, id, input) {
        const repo = this.connection.getRepository(ctx, supplier_entity_1.Supplier);
        const supplier = await repo.findOne({ where: { id: id } });
        if (!supplier)
            throw new core_1.UserInputError(`Supplier ${id} not found`);
        if (input.code != null && input.code !== supplier.code) {
            await this.assertSupplierCodeUnique(ctx, input.code, id);
            supplier.code = input.code;
        }
        if (input.name != null)
            supplier.name = input.name;
        if (input.taxNumber != null)
            supplier.taxNumber = input.taxNumber;
        if (input.contactName != null)
            supplier.contactName = input.contactName;
        if (input.contactPhone != null)
            supplier.contactPhone = input.contactPhone;
        if (input.address != null)
            supplier.address = input.address;
        if (input.settlementDays != null)
            supplier.settlementDays = input.settlementDays;
        if (input.note != null)
            supplier.note = input.note;
        return repo.save(supplier);
    }
    async deleteSupplier(ctx, id) {
        // 删除前置校验：已有采购单的供应商禁止删除
        const purchaseRepo = this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder);
        const linked = await purchaseRepo.count({ where: { supplierId: id } });
        if (linked > 0) {
            throw new core_1.UserInputError(`Supplier ${id} has ${linked} purchase order(s), cannot delete`);
        }
        await this.connection.getRepository(ctx, supplier_entity_1.Supplier).delete({ id: id });
        return true;
    }
    async findSuppliers(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const qb = this.connection.getRepository(ctx, supplier_entity_1.Supplier)
            .createQueryBuilder('s')
            .andWhere('s.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('s.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.keyword) {
            qb.andWhere('(s.name LIKE :kw OR s.code LIKE :kw OR s.taxNumber LIKE :kw)', {
                kw: `%${options.keyword}%`,
            });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOneSupplier(ctx, id) {
        return this.connection.getRepository(ctx, supplier_entity_1.Supplier).findOne({ where: { id: id } });
    }
    // ===== 采购单 =====
    async createPurchaseOrder(ctx, input) {
        var _a, _b, _c;
        if (!input.lines || input.lines.length === 0) {
            throw new core_1.UserInputError('Purchase order requires at least one line');
        }
        for (const l of input.lines) {
            if (!l.quantity || l.quantity <= 0) {
                throw new core_1.UserInputError('Line quantity must be positive');
            }
        }
        const supplierRepo = this.connection.getRepository(ctx, supplier_entity_1.Supplier);
        const supplier = await supplierRepo.findOne({ where: { id: input.supplierId } });
        if (!supplier)
            throw new core_1.UserInputError(`Supplier ${input.supplierId} not found`);
        const order = new purchase_order_entity_1.PurchaseOrder({
            code: this.generateCode('CG'),
            state: constants_1.PurchaseOrderState.Draft,
            supplierId: input.supplierId,
            targetLocationId: input.targetLocationId,
            note: (_a = input.note) !== null && _a !== void 0 ? _a : null,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            orderDate: (_b = input.orderDate) !== null && _b !== void 0 ? _b : new Date(),
            expectedArrivalDate: (_c = input.expectedArrivalDate) !== null && _c !== void 0 ? _c : null,
            channelId: ctx.channelId,
        });
        order.lines = input.lines.map(l => {
            var _a;
            return new purchase_order_entity_1.PurchaseOrderLine({
                productVariantId: l.productVariantId,
                quantity: l.quantity,
                receivedQuantity: 0,
                unitPrice: (_a = l.unitPrice) !== null && _a !== void 0 ? _a : null,
            });
        });
        order.totalAmount = order.lines.reduce((s, l) => s + l.amount, 0);
        order.channels = [ctx.channel];
        return this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder).save(order);
    }
    async findPurchaseOrders(ctx, options) {
        var _a, _b;
        const page = (_a = options === null || options === void 0 ? void 0 : options.page) !== null && _a !== void 0 ? _a : 1;
        const pageSize = (_b = options === null || options === void 0 ? void 0 : options.pageSize) !== null && _b !== void 0 ? _b : 20;
        const qb = this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.supplier', 'supplier')
            .leftJoinAndSelect('order.targetLocation', 'targetLocation')
            .leftJoinAndSelect('order.lines', 'lines')
            .andWhere('order.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('order.createdAt', 'DESC');
        if (options === null || options === void 0 ? void 0 : options.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOnePurchaseOrder(ctx, id) {
        return this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder).findOne({
            where: { id: id },
            relations: ['lines', 'supplier', 'targetLocation'],
        });
    }
    async placePurchaseOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder);
        const order = await repo.findOne({ where: { id: id }, relations: ['lines'] });
        if (!order)
            throw new core_1.UserInputError(`PurchaseOrder ${id} not found`);
        this.assertTransition(order, constants_1.PurchaseOrderState.Draft, constants_1.PurchaseOrderState.Ordered, constants_1.PURCHASE_ORDER_TRANSITIONS);
        order.state = constants_1.PurchaseOrderState.Ordered;
        order.orderedAt = new Date();
        return repo.save(order);
    }
    /**
     * 分批收货：deltas 为本次实收增量 [{ lineId, quantity }]，累加 receivedQuantity，
     * 单行超收/负数校验，全部收满 → Received，未收满 → PartiallyReceived。
     * 每行按增量对 targetLocation 调库(+delta) 并写 purchase 账本。
     */
    async receivePurchaseOrder(ctx, id, deltas) {
        if (!deltas || deltas.length === 0) {
            throw new core_1.UserInputError('Receive requires at least one line');
        }
        return this.connection.withTransaction(ctx, async (txCtx) => {
            const repo = this.connection.getRepository(txCtx, purchase_order_entity_1.PurchaseOrder);
            const order = await repo.findOne({ where: { id: id }, relations: ['lines'] });
            if (!order)
                throw new core_1.UserInputError(`PurchaseOrder ${id} not found`);
            if (![constants_1.PurchaseOrderState.Ordered, constants_1.PurchaseOrderState.PartiallyReceived].includes(order.state)) {
                throw new core_1.UserInputError(`Cannot receive purchase order in state: ${order.state}`);
            }
            let allFilled = true;
            for (const d of deltas) {
                if (!d.quantity || d.quantity <= 0) {
                    throw new core_1.UserInputError(`Receive quantity for line ${d.lineId} must be positive`);
                }
                const line = order.lines.find(l => String(l.id) === String(d.lineId));
                if (!line)
                    throw new core_1.UserInputError(`Line ${d.lineId} not found in order ${id}`);
                const newReceived = line.receivedQuantity + d.quantity;
                if (newReceived > line.quantity) {
                    throw new core_1.UserInputError(`Line ${d.lineId} over-received: ordered ${line.quantity}, received would be ${newReceived}`);
                }
                // 调库 + 写 purchase 账本
                await this.adjustStockForLocation(txCtx, line.productVariantId, order.targetLocationId, d.quantity, `PurchaseOrder#${order.code}:purchase-in`, { bizType: 'purchase', bizCode: order.code });
                line.receivedQuantity = newReceived;
                if (newReceived < line.quantity) {
                    allFilled = false;
                }
            }
            // 校验未在本次收货列表中的行也必须已收满，才能置 Received
            for (const line of order.lines) {
                if (line.receivedQuantity < line.quantity) {
                    allFilled = false;
                    break;
                }
            }
            order.state = allFilled ? constants_1.PurchaseOrderState.Received : constants_1.PurchaseOrderState.PartiallyReceived;
            return repo.save(order);
        });
    }
    async completePurchaseOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder);
        const order = await repo.findOne({ where: { id: id } });
        if (!order)
            throw new core_1.UserInputError(`PurchaseOrder ${id} not found`);
        this.assertTransition(order, constants_1.PurchaseOrderState.Received, constants_1.PurchaseOrderState.Completed, constants_1.PURCHASE_ORDER_TRANSITIONS);
        order.state = constants_1.PurchaseOrderState.Completed;
        order.completedAt = new Date();
        return repo.save(order);
    }
    async cancelPurchaseOrder(ctx, id) {
        const repo = this.connection.getRepository(ctx, purchase_order_entity_1.PurchaseOrder);
        const order = await repo.findOne({ where: { id: id } });
        if (!order)
            throw new core_1.UserInputError(`PurchaseOrder ${id} not found`);
        if (![constants_1.PurchaseOrderState.Draft, constants_1.PurchaseOrderState.Ordered].includes(order.state)) {
            throw new core_1.UserInputError(`Cannot cancel purchase order in state: ${order.state}`);
        }
        order.state = constants_1.PurchaseOrderState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.StockMovementService,
        core_1.StockLevelService,
        core_1.StockLocationService,
        stock_ledger_service_1.StockLedgerService])
], InventoryService);
