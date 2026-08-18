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
     * 售后退货回补：将收到的退货回补到原发货仓，同一事务内写 afterSales 账本。
     * 供 after-sales-plugin 在 confirmReceive（Returning→Received）时调用。
     * @param quantity 正数表示回补数量（= min(订单行数量, 实收数量)）
     */
    async applyAfterSalesRestock(ctx, variantId, locationId, quantity, afterSalesCode, orderLineId) {
        await this.adjustStockForLocation(ctx, variantId, locationId, +quantity, `AfterSales#${afterSalesCode}:return-restock`, { bizType: 'afterSales', bizCode: afterSalesCode, orderLineId });
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
        const locations = (await this.stockLocationService.findAll(ctx, { take: 10000 })).items;
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
