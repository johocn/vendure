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
exports.PickBatchService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const pick_batch_entity_1 = require("./pick-batch.entity");
const pick_batch_order_entity_1 = require("./pick-batch-order.entity");
const pick_batch_math_1 = require("./pick-batch-math");
const storage_bin_entity_1 = require("../storage/storage-bin.entity");
const storage_zone_entity_1 = require("../storage/storage-zone.entity");
const variant_storage_bin_entity_1 = require("../storage/variant-storage-bin.entity");
let PickBatchService = class PickBatchService {
    constructor(connection, stockLocationService, orderService, fulfillmentService) {
        this.connection = connection;
        this.stockLocationService = stockLocationService;
        this.orderService = orderService;
        this.fulfillmentService = fulfillmentService;
    }
    /** 该批次的渠道归属，所有读写都必须带 tenantChannelId 过滤 */
    tenantOf(ctx) {
        return String(ctx.channelId);
    }
    async findAll(ctx, options) {
        var _a, _b;
        const page = Math.max(1, (_a = options.page) !== null && _a !== void 0 ? _a : 1);
        const pageSize = Math.min(100, Math.max(1, (_b = options.pageSize) !== null && _b !== void 0 ? _b : 20));
        const repo = this.connection.getRepository(ctx, pick_batch_entity_1.PickBatch);
        const qb = repo
            .createQueryBuilder('b')
            .where('b.tenantChannelId = :t', { t: this.tenantOf(ctx) })
            .orderBy('b.id', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize);
        if (options.state)
            qb.andWhere('b.state = :s', { s: options.state });
        if (options.stockLocationId) {
            qb.andWhere('b.stockLocationId = :w', { w: options.stockLocationId });
        }
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }
    async findOne(ctx, id) {
        return this.connection.getRepository(ctx, pick_batch_entity_1.PickBatch).findOne({
            where: { id: id, tenantChannelId: this.tenantOf(ctx) },
        });
    }
    async members(ctx, batchId) {
        return this.connection.getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder).find({
            where: { batchId: batchId },
            order: { id: 'ASC' },
        });
    }
    /**
     * 同一订单不得同时存在于两个非终态批次中。
     * 命中时返回冲突批次号，供上层拼装明确原因。
     */
    async findConflicts(ctx, orderIds, excludeBatchId) {
        if (orderIds.length === 0)
            return new Map();
        const qb = this.connection
            .getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder)
            .createQueryBuilder('o')
            .innerJoin(pick_batch_entity_1.PickBatch, 'b', 'b.id = o.batchId')
            .where('o.orderId IN (:...ids)', { ids: orderIds })
            .andWhere('b.tenantChannelId = :t', { t: this.tenantOf(ctx) })
            .andWhere('b.state NOT IN (:...done)', { done: ['SHIPPED', 'CANCELLED'] });
        if (excludeBatchId) {
            qb.andWhere('b.id != :ex', { ex: excludeBatchId });
        }
        const rows = await qb
            .select(['o.orderId AS orderId', 'b.id AS batchId', 'b.code AS code'])
            .getRawMany();
        const map = new Map();
        for (const r of rows) {
            map.set(Number(r.orderId), { batchId: Number(r.batchId), code: r.code });
        }
        return map;
    }
    /** 生成当日下一个批次号 */
    async nextCode(ctx, now = new Date()) {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const prefix = `PB${y}${m}${d}-`;
        const count = await this.connection
            .getRepository(ctx, pick_batch_entity_1.PickBatch)
            .createQueryBuilder('b')
            .where('b.code LIKE :p', { p: `${prefix}%` })
            .getCount();
        return (0, pick_batch_math_1.formatBatchCode)(now, (0, pick_batch_math_1.nextSequence)(count));
    }
    async create(ctx, input, createdBy) {
        var _a;
        if (input.orderIds.length === 0) {
            throw new core_1.UserInputError('请至少选择一张订单');
        }
        const conflicts = await this.findConflicts(ctx, input.orderIds);
        if (conflicts.size > 0) {
            const [orderId, hit] = [...conflicts.entries()][0];
            throw new core_1.UserInputError(`订单 #${orderId} 已在批次 ${hit.code} 中，请先移出`);
        }
        const repo = this.connection.getRepository(ctx, pick_batch_entity_1.PickBatch);
        const batch = await repo.save(repo.create({
            code: await this.nextCode(ctx),
            tenantChannelId: this.tenantOf(ctx),
            stockLocationId: input.stockLocationId,
            state: 'PENDING',
            note: (_a = input.note) !== null && _a !== void 0 ? _a : null,
            createdBy,
        }));
        const mRepo = this.connection.getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder);
        await mRepo.save(input.orderIds.map((orderId) => mRepo.create({ batchId: batch.id, orderId, addedAt: new Date() })));
        return batch;
    }
    async addOrders(ctx, batchId, orderIds) {
        const batch = await this.requireBatch(ctx, batchId);
        this.assertState(batch, ['PENDING', 'PICKED'], '加单');
        const conflicts = await this.findConflicts(ctx, orderIds, batchId);
        if (conflicts.size > 0) {
            const [orderId, hit] = [...conflicts.entries()][0];
            throw new core_1.UserInputError(`订单 #${orderId} 已在批次 ${hit.code} 中，请先移出`);
        }
        const mRepo = this.connection.getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder);
        await mRepo.save(orderIds.map((orderId) => mRepo.create({ batchId: batchId, orderId, addedAt: new Date() })));
        return batch;
    }
    async removeOrders(ctx, batchId, orderIds) {
        const batch = await this.requireBatch(ctx, batchId);
        this.assertState(batch, ['PENDING', 'PICKED'], '移出订单');
        await this.connection
            .getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder)
            .createQueryBuilder()
            .delete()
            .where('batchId = :b AND orderId IN (:...ids)', { b: batchId, ids: orderIds })
            .execute();
        return batch;
    }
    async advance(ctx, batchId, to) {
        const batch = await this.requireBatch(ctx, batchId);
        if (!(0, pick_batch_math_1.canTransition)(batch.state, to)) {
            throw new core_1.UserInputError(`批次 ${batch.code} 不能从 ${batch.state} 变为 ${to}`);
        }
        batch.state = to;
        const now = new Date();
        if (to === 'PICKED')
            batch.pickedAt = now;
        if (to === 'PRINTED')
            batch.printedAt = now;
        if (to === 'SHIPPED')
            batch.shippedAt = now;
        return this.connection.getRepository(ctx, pick_batch_entity_1.PickBatch).save(batch);
    }
    async cancel(ctx, batchId) {
        return this.advance(ctx, batchId, 'CANCELLED');
    }
    /**
     * 拣货汇总：按 SKU 合并数量、收集涉及订单号，并按库位排序出拣货路径。
     * 三档共用：zone 档下 rowNo / levelNo 为 null，排序自动退化为按库区。
     * 用仓储 + JS 聚合实现（方言无关，sqlite / postgres 行为一致）。
     */
    async pickingList(ctx, batchId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const batch = await this.requireBatch(ctx, batchId);
        const members = await this.members(ctx, batchId);
        if (members.length === 0)
            return [];
        const orderIds = members.map((m) => m.orderId);
        const orders = await this.connection.getRepository(ctx, core_1.Order).find({
            where: { id: (0, typeorm_1.In)(orderIds) },
            relations: { lines: { productVariant: true } },
        });
        // SKU 合并数量 + 涉及订单号
        const bySku = new Map();
        const variantIds = new Set();
        for (const o of orders) {
            for (const line of (_a = o.lines) !== null && _a !== void 0 ? _a : []) {
                const sku = (_c = (_b = line.productVariant) === null || _b === void 0 ? void 0 : _b.sku) !== null && _c !== void 0 ? _c : '';
                if (!sku)
                    continue;
                variantIds.add(line.productVariant.id);
                const hit = (_d = bySku.get(sku)) !== null && _d !== void 0 ? _d : {
                    sku,
                    // ProductVariant.name 列可为 null：SDL 里 name 是非空字段，
                    // 直接透传会让整条 pickBatchPickingList 查询报错返回 null（前端表现为拣货汇总空白）。
                    // 与前端 `r.name || r.sku` 一致，缺失时回退 SKU。
                    name: line.productVariant.name || line.productVariant.sku || '',
                    qty: 0,
                    codes: new Set(),
                };
                hit.qty += line.quantity;
                hit.codes.add(o.code);
                bySku.set(sku, hit);
            }
        }
        if (bySku.size === 0)
            return [];
        // 库位绑定（该批次目标仓）
        const bindings = await this.connection.getRepository(ctx, variant_storage_bin_entity_1.VariantStorageBin).find({
            where: {
                tenantChannelId: this.tenantOf(ctx),
                stockLocationId: batch.stockLocationId,
                variantId: (0, typeorm_1.In)([...variantIds]),
            },
        });
        const binIds = bindings.map((b) => b.binId).filter((x) => x !== null);
        const zoneIds = bindings.map((b) => b.zoneId).filter((x) => x !== null);
        const bins = binIds.length
            ? await this.connection.getRepository(ctx, storage_bin_entity_1.StorageBin).find({ where: { id: (0, typeorm_1.In)(binIds) } })
            : [];
        const zones = zoneIds.length
            ? await this.connection.getRepository(ctx, storage_zone_entity_1.StorageZone).find({ where: { id: (0, typeorm_1.In)(zoneIds) } })
            : [];
        const binById = new Map(bins.map((b) => [b.id, b]));
        const zoneById = new Map(zones.map((z) => [z.id, z]));
        const bindingByVariant = new Map(bindings.map((b) => [b.variantId, b]));
        const inputs = [];
        for (const hit of bySku.values()) {
            // 同一 SKU 可能对应多个 variant，取任一有绑定的推算库位
            const variant = [...variantIds].find((vid) => bindingByVariant.has(vid) &&
                orders.some((o) => {
                    var _a;
                    return ((_a = o.lines) !== null && _a !== void 0 ? _a : []).some((l) => { var _a, _b; return ((_a = l.productVariant) === null || _a === void 0 ? void 0 : _a.id) === vid && ((_b = l.productVariant) === null || _b === void 0 ? void 0 : _b.sku) === hit.sku; });
                }));
            const binding = variant !== undefined ? bindingByVariant.get(variant) : undefined;
            const bin = (binding === null || binding === void 0 ? void 0 : binding.binId) != null ? binById.get(binding.binId) : undefined;
            const zone = (binding === null || binding === void 0 ? void 0 : binding.zoneId) != null ? zoneById.get(binding.zoneId) : undefined;
            inputs.push({
                sku: hit.sku,
                name: hit.name,
                qty: hit.qty,
                orderCodes: [...hit.codes].sort(),
                zoneSortOrder: (_e = zone === null || zone === void 0 ? void 0 : zone.sortOrder) !== null && _e !== void 0 ? _e : null,
                rowNo: (_f = bin === null || bin === void 0 ? void 0 : bin.rowNo) !== null && _f !== void 0 ? _f : null,
                levelNo: (_g = bin === null || bin === void 0 ? void 0 : bin.levelNo) !== null && _g !== void 0 ? _g : null,
                binCode: (_h = bin === null || bin === void 0 ? void 0 : bin.code) !== null && _h !== void 0 ? _h : null,
                zoneCode: (_j = zone === null || zone === void 0 ? void 0 : zone.code) !== null && _j !== void 0 ? _j : null,
                zoneName: (_k = zone === null || zone === void 0 ? void 0 : zone.name) !== null && _k !== void 0 ? _k : null,
            });
        }
        return (0, pick_batch_math_1.sortPickingRows)(inputs);
    }
    /** 候选订单的就近选仓推荐 */
    recommend(order, warehouses) {
        var _a, _b, _c;
        const shipping = order.shippingAddress;
        return (0, pick_batch_math_1.pickRecommendation)({
            city: (_a = shipping === null || shipping === void 0 ? void 0 : shipping.city) !== null && _a !== void 0 ? _a : null,
            lat: (_b = shipping === null || shipping === void 0 ? void 0 : shipping.latitude) !== null && _b !== void 0 ? _b : null,
            lng: (_c = shipping === null || shipping === void 0 ? void 0 : shipping.longitude) !== null && _c !== void 0 ? _c : null,
        }, warehouses);
    }
    /** 批次列表视图：补 SDL 要求的 memberCount / itemCount */
    async warehouseCandidates(ctx) {
        const { items } = await this.stockLocationService.findAll(ctx, { take: 500 });
        return items.map((l) => {
            var _a, _b;
            const cf = (_a = l.customFields) !== null && _a !== void 0 ? _a : {};
            return {
                id: Number(l.id),
                enabled: true,
                serviceCities: ((_b = cf.serviceCities) !== null && _b !== void 0 ? _b : null),
                lat: typeof cf.lat === 'number' ? cf.lat : null,
                lng: typeof cf.lng === 'number' ? cf.lng : null,
            };
        });
    }
    /** 各批次成员数与件数 */
    async counts(ctx, batchIds) {
        var _a;
        const out = new Map();
        if (batchIds.length === 0)
            return out;
        const memberRows = await this.connection
            .getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder)
            .createQueryBuilder('o')
            .select('o.batchId', 'batchId')
            .addSelect('COUNT(1)', 'n')
            .where('o.batchId IN (:...ids)', { ids: batchIds })
            .groupBy('o.batchId')
            .getRawMany();
        const allMembers = await this.connection.getRepository(ctx, pick_batch_order_entity_1.PickBatchOrder).find({
            where: { batchId: (0, typeorm_1.In)(batchIds) },
        });
        const orderIds = allMembers.map((m) => m.orderId);
        const lineRows = orderIds.length
            ? await this.connection
                .getRepository(ctx, core_1.OrderLine)
                .createQueryBuilder('l')
                .select('l.orderId', 'orderId')
                .addSelect('COALESCE(SUM(l.quantity), 0)', 'n')
                .where('l.orderId IN (:...ids)', { ids: orderIds })
                .groupBy('l.orderId')
                .getRawMany()
            : [];
        const qtyByOrder = new Map(lineRows.map((r) => [Number(r.orderId), Number(r.n)]));
        for (const id of batchIds) {
            out.set(id, { memberCount: 0, itemCount: 0 });
        }
        for (const r of memberRows) {
            const hit = out.get(Number(r.batchId));
            if (hit)
                hit.memberCount = Number(r.n);
        }
        for (const m of allMembers) {
            const hit = out.get(m.batchId);
            if (hit)
                hit.itemCount += (_a = qtyByOrder.get(m.orderId)) !== null && _a !== void 0 ? _a : 0;
        }
        return out;
    }
    /** 列表视图：批次字段 + memberCount / itemCount */
    async findAllView(ctx, options) {
        const { items, totalItems } = await this.findAll(ctx, options);
        const counts = await this.counts(ctx, items.map((b) => Number(b.id)));
        return {
            totalItems,
            items: items.map((b) => this.toView(b, counts.get(Number(b.id)))),
        };
    }
    /** 详情视图：批次字段 + members（订单快照） */
    async detail(ctx, id) {
        const batch = await this.findOne(ctx, id);
        if (!batch)
            return null;
        const counts = await this.counts(ctx, [Number(batch.id)]);
        return Object.assign(Object.assign({}, this.toView(batch, counts.get(Number(batch.id)))), { members: await this.membersSnapshot(ctx, batch.id) });
    }
    toView(b, counts) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            id: String(b.id),
            code: b.code,
            stockLocationId: b.stockLocationId,
            state: b.state,
            note: (_a = b.note) !== null && _a !== void 0 ? _a : null,
            createdBy: (_b = b.createdBy) !== null && _b !== void 0 ? _b : null,
            memberCount: (_c = counts === null || counts === void 0 ? void 0 : counts.memberCount) !== null && _c !== void 0 ? _c : 0,
            itemCount: (_d = counts === null || counts === void 0 ? void 0 : counts.itemCount) !== null && _d !== void 0 ? _d : 0,
            pickedAt: (_e = b.pickedAt) !== null && _e !== void 0 ? _e : null,
            printedAt: (_f = b.printedAt) !== null && _f !== void 0 ? _f : null,
            shippedAt: (_g = b.shippedAt) !== null && _g !== void 0 ? _g : null,
            createdAt: (_h = b.createdAt) !== null && _h !== void 0 ? _h : null,
        };
    }
    /** 批次成员订单快照（含推荐仓与距离） */
    async membersSnapshot(ctx, batchId) {
        const members = await this.members(ctx, batchId);
        if (members.length === 0)
            return [];
        const orders = await this.connection.getRepository(ctx, core_1.Order).find({
            where: { id: (0, typeorm_1.In)(members.map((m) => m.orderId)) },
            relations: { lines: true, customer: true },
        });
        const warehouses = await this.warehouseCandidates(ctx);
        const byId = new Map(orders.map((o) => [Number(o.id), o]));
        return members
            .map((m) => byId.get(m.orderId))
            .filter((o) => !!o)
            .map((o) => this.snapshotOrder(o, warehouses));
    }
    /**
     * 待发货候选订单：默认 PaymentAuthorized / WaitingForShipping，
     * 带就近仓推荐与「已在某批次」标记（设计 §6.2）。
     */
    async candidates(ctx, options) {
        var _a, _b;
        const page = Math.max(1, (_a = options.page) !== null && _a !== void 0 ? _a : 1);
        const pageSize = Math.min(100, Math.max(1, (_b = options.pageSize) !== null && _b !== void 0 ? _b : 20));
        const repo = this.connection.getRepository(ctx, core_1.Order);
        const [orders, totalItems] = await repo.findAndCount({
            where: { state: (0, typeorm_1.In)(['PaymentAuthorized', 'WaitingForShipping']) },
            relations: { lines: true, customer: true },
            order: { id: 'DESC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        if (orders.length === 0)
            return { items: [], totalItems };
        const warehouses = await this.warehouseCandidates(ctx);
        const conflicts = await this.findConflicts(ctx, orders.map((o) => Number(o.id)));
        return {
            totalItems,
            items: orders.map((o) => this.snapshotOrder(o, warehouses, conflicts.get(Number(o.id)))),
        };
    }
    snapshotOrder(order, warehouses, conflict) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const a = (_a = order.shippingAddress) !== null && _a !== void 0 ? _a : {};
        const rec = this.recommend(order, warehouses);
        const name = [(_b = order.customer) === null || _b === void 0 ? void 0 : _b.firstName, (_c = order.customer) === null || _c === void 0 ? void 0 : _c.lastName].filter(Boolean).join(' ');
        const address = [a.province, a.city, a.streetLine1, a.streetLine2]
            .filter((x) => !!x)
            .join('');
        return {
            id: String(order.id),
            code: order.code,
            state: String(order.state),
            customerName: a.fullName || name || null,
            phoneNumber: (_f = (_d = a.phoneNumber) !== null && _d !== void 0 ? _d : (_e = order.customer) === null || _e === void 0 ? void 0 : _e.phoneNumber) !== null && _f !== void 0 ? _f : null,
            province: (_g = a.province) !== null && _g !== void 0 ? _g : null,
            city: (_h = a.city) !== null && _h !== void 0 ? _h : null,
            streetLine1: (_j = a.streetLine1) !== null && _j !== void 0 ? _j : null,
            streetLine2: (_k = a.streetLine2) !== null && _k !== void 0 ? _k : null,
            postalCode: (_l = a.postalCode) !== null && _l !== void 0 ? _l : null,
            address,
            itemCount: ((_m = order.lines) !== null && _m !== void 0 ? _m : []).reduce((n, l) => n + l.quantity, 0),
            recommendedStockLocationId: rec.recommendedStockLocationId === null ? null : String(rec.recommendedStockLocationId),
            distanceKm: rec.distanceKm,
            inBatchId: conflict ? String(conflict.batchId) : null,
            inBatchCode: (_o = conflict === null || conflict === void 0 ? void 0 : conflict.code) !== null && _o !== void 0 ? _o : null,
        };
    }
    /** 订单行中尚未被任何履约覆盖的部分 */
    pendingFulfillmentLines(order) {
        var _a, _b, _c, _d;
        const covered = new Map();
        for (const f of (_a = order.fulfillments) !== null && _a !== void 0 ? _a : []) {
            for (const fl of (_b = f.lines) !== null && _b !== void 0 ? _b : []) {
                const key = String(fl.orderLineId);
                covered.set(key, ((_c = covered.get(key)) !== null && _c !== void 0 ? _c : 0) + fl.quantity);
            }
        }
        return ((_d = order.lines) !== null && _d !== void 0 ? _d : [])
            .map((l) => { var _a; return ({ orderLineId: l.id, quantity: l.quantity - ((_a = covered.get(String(l.id))) !== null && _a !== void 0 ? _a : 0) }); })
            .filter((l) => l.quantity > 0);
    }
    /**
     * 批量发货：逐单生成独立 fulfillment（不合并包裹、不合并运单）。
     * 全部成功才推进到 SHIPPED；有失败则保持原状态并返回失败清单（设计 §5）。
     */
    async ship(ctx, batchId, input) {
        var _a, _b;
        const batch = await this.requireBatch(ctx, batchId);
        this.assertState(batch, ['PENDING', 'PICKED', 'PRINTED'], '发货');
        const members = await this.members(ctx, batchId);
        const args = [{ name: 'method', value: input.method || 'standard' }];
        if (input.trackingCode)
            args.push({ name: 'trackingCode', value: input.trackingCode });
        const handler = { code: 'manual-fulfillment', arguments: args };
        const succeeded = [];
        const failed = [];
        for (const m of members) {
            const order = (await this.orderService.findOne(ctx, m.orderId, [
                'lines',
                'fulfillments',
                'fulfillments.lines',
            ]));
            if (!order) {
                failed.push({ orderId: String(m.orderId), code: '', reason: '订单不存在' });
                continue;
            }
            try {
                const remaining = this.pendingFulfillmentLines(order);
                if (remaining.length === 0) {
                    succeeded.push({ orderId: String(order.id), code: order.code, fulfillmentId: null });
                    continue;
                }
                const created = await this.fulfillmentService.create(ctx, [order], remaining, handler);
                if (!(created instanceof core_1.Fulfillment)) {
                    throw new Error((_a = created === null || created === void 0 ? void 0 : created.message) !== null && _a !== void 0 ? _a : '生成发货单失败');
                }
                succeeded.push({
                    orderId: String(order.id),
                    code: order.code,
                    fulfillmentId: String(created.id),
                });
            }
            catch (e) {
                failed.push({ orderId: String(order.id), code: order.code, reason: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : '发货失败' });
            }
        }
        // 全部成功才置 SHIPPED：状态机不允许跳级，按链条逐级推进
        if (failed.length === 0 && succeeded.length > 0) {
            let current = batch.state;
            for (const step of ['PICKED', 'PRINTED', 'SHIPPED']) {
                if (current === 'SHIPPED')
                    break;
                await this.advance(ctx, batchId, step);
                current = step;
            }
        }
        return { succeeded, failed };
    }
    async requireBatch(ctx, id) {
        const batch = await this.findOne(ctx, id);
        if (!batch)
            throw new core_1.UserInputError(`批次 ${id} 不存在`);
        return batch;
    }
    assertState(batch, allowed, action) {
        if (!allowed.includes(batch.state)) {
            throw new core_1.UserInputError(`批次 ${batch.code} 当前为 ${batch.state}，不可${action}`);
        }
    }
};
exports.PickBatchService = PickBatchService;
exports.PickBatchService = PickBatchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.StockLocationService,
        core_1.OrderService,
        core_1.FulfillmentService])
], PickBatchService);
//# sourceMappingURL=pick-batch.service.js.map