// e:\code\vendure\packages\inventory-plugin\src\inventory.service.ts
import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    AdministratorService,
    Allocation,
    ForbiddenError,
    Logger,
    OrderLine,
    Product,
    ProductVariant,
    RequestContext,
    Sale,
    StockAdjustment,
    StockLevel,
    StockLevelService,
    StockLocationService,
    StockMovementService,
    StockLocation,
    TransactionalConnection,
    UserInputError,
    idsAreEqual,
} from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';

import {
    STOCK_IN_TRANSITIONS,
    STOCK_OUT_TRANSITIONS,
    STOCK_MOVE_TRANSITIONS,
    STOCKTAKE_TRANSITIONS,
    PURCHASE_ORDER_TRANSITIONS,
    StockInState,
    StockOutState,
    StockMoveState,
    StocktakeState,
    PurchaseOrderState,
} from './constants';
import { StockInOrder, StockInOrderLine } from './entities/stock-in-order.entity';
import { StockOutOrder, StockOutOrderLine } from './entities/stock-out-order.entity';
import { StockMoveOrder, StockMoveOrderLine } from './entities/stock-move-order.entity';
import { StocktakeOrder, StocktakeOrderLine } from './entities/stocktake-order.entity';
import { Supplier } from './entities/supplier.entity';
import { PurchaseOrder, PurchaseOrderLine } from './entities/purchase-order.entity';
import { StockLedgerService, StockLedgerInput, LedgerBizType } from './stock-ledger.service';

const loggerCtx = 'InventoryService';

/** 账本元信息（写入 adjustStockForLocation 时可选传入，用于在仓库/门店维度落供销存账本）。 */
export interface LedgerMeta {
    bizType: LedgerBizType;
    bizCode?: string;
    orderLineId?: ID;
    otherLocationId?: ID;
}

@Injectable()
export class InventoryService {
    constructor(
        private connection: TransactionalConnection,
        private stockMovementService: StockMovementService,
        private stockLevelService: StockLevelService,
        private stockLocationService: StockLocationService,
        private stockLedgerService: StockLedgerService,
        private administratorService: AdministratorService,
    ) {}

    // ===== 内部辅助方法 =====

    /**
     * 调整某仓库的库存（delta 为正数表示增加，负数表示减少）
     * 通过 adjustProductVariantStock 写入 StockAdjustment 流水
     * 在 customFields.businessReason 记录业务来源（无需二次查询）
     */
    protected async adjustStockForLocation(
        ctx: RequestContext,
        variantId: ID,
        locationId: ID,
        delta: number,
        reason: string,
        meta?: LedgerMeta,
    ): Promise<void> {
        const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const beforeOnHand = current.stockOnHand;
        const newOnHand = beforeOnHand + delta;
        const adjustments = await this.stockMovementService.adjustProductVariantStock(
            ctx,
            variantId,
            [{ stockLocationId: locationId, stockOnHand: newOnHand }],
        );
        // 直接写入 customFields.businessReason
        const adjustmentRepo = this.connection.getRepository(ctx, StockAdjustment);
        for (const adj of adjustments) {
            adj.customFields = { ...(adj.customFields as any ?? {}), businessReason: reason } as any;
            await adjustmentRepo.save(adj);
        }
        // 供销存账本：真实 onHand 变动，同事务写一条
        if (meta) {
            const ledgerInput: StockLedgerInput = {
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
        Logger.info(`Stock adjusted: variant=${variantId} location=${locationId} delta=${delta} reason=${reason}`, loggerCtx);
    }

    /**
     * 手工校准某仓可变体库存为指定绝对数量（delta = 目标 - 当前，写 manual 账本便于追溯）。
     * delta 为 0 时不写任何流水。
     */
    async setStockForVariant(
        ctx: RequestContext,
        variantId: ID,
        locationId: ID,
        stockOnHand: number,
        reason = 'manual-adjust',
    ): Promise<void> {
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
    async applyAfterSalesRestock(
        ctx: RequestContext,
        variantId: ID,
        locationId: ID,
        quantity: number,
        afterSalesCode: string,
        orderLineId?: ID,
    ): Promise<void> {
        await this.adjustStockForLocation(
            ctx,
            variantId,
            locationId,
            +quantity,
            `AfterSales#${afterSalesCode}:return-restock`,
            { bizType: 'afterSales', bizCode: afterSalesCode, orderLineId },
        );
    }

    /**
     * 售后退货多仓按包回补：按 orderLine 的 Allocation 记录（各仓实际发货量）将退货按比例回补到各仓。
     * - 单仓 → 退化现有 applyAfterSalesRestock（回补该仓）
     * - 多仓 → 最大余数法整数分配，逐仓 adjustStockForLocation 写 afterSales:in 账本
     * - 兜底：查不到 Allocation → 回退 orderLine.customFields.stockLocationId 单仓（现状行为）
     * @returns 各仓回补明细 [{ stockLocationId, quantity }]（供 restockJson 留痕）
     */
    async applyAfterSalesRestockMulti(
        ctx: RequestContext,
        orderLineId: ID,
        quantity: number,
        afterSalesCode: string,
    ): Promise<Array<{ stockLocationId: ID; quantity: number }>> {
        // 1. 取订单行 + variant
        const orderLine = await this.connection.getRepository(ctx, OrderLine).findOne({
            where: { id: orderLineId as any },
        });
        if (!orderLine) {
            throw new UserInputError(`OrderLine not found: ${orderLineId}`);
        }
        const variantId = orderLine.productVariantId;

        // 2. 按仓分组求和（Allocation 记录为各仓实际发货量，取绝对值）
        //    注意：不能按 Sale 分组 —— core 的 createSalesForOrder 每条 Sale 都记整行数量
        const allocations = await this.connection.getRepository(ctx, Allocation).find({
            where: { orderLine: { id: orderLineId as any } } as any,
        });
        const shippedByLoc = new Map<string, number>();
        for (const a of allocations) {
            const locId = String(a.stockLocationId);
            if (!locId) continue;
            shippedByLoc.set(locId, (shippedByLoc.get(locId) ?? 0) + Math.abs(Number(a.quantity) || 0));
        }

        // 3. 兜底：查不到 Allocation → 回退 orderLine.customFields.stockLocationId 单仓（现状行为）
        if (shippedByLoc.size === 0) {
            const fallbackLoc = (orderLine.customFields as any)?.stockLocationId ?? null;
            if (fallbackLoc != null && quantity > 0) {
                await this.applyAfterSalesRestock(ctx, variantId, fallbackLoc as any, quantity, afterSalesCode, orderLineId);
                return [{ stockLocationId: fallbackLoc as any, quantity: +quantity }];
            }
            Logger.warn(`applyAfterSalesRestockMulti: orderLine ${orderLineId} 无 Allocation 亦无 stockLocationId，跳过回补`, loggerCtx);
            return [];
        }

        // 4. 单仓 → 退化现有 applyAfterSalesRestock
        if (shippedByLoc.size === 1) {
            const [locId] = [...shippedByLoc.keys()];
            await this.applyAfterSalesRestock(ctx, variantId, locId as any, quantity, afterSalesCode, orderLineId);
            return [{ stockLocationId: locId as any, quantity: +quantity }];
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
            if (remaining <= 0) break;
            e.floor += 1;
            remaining -= 1;
        }

        // 6. 逐仓回补 + 落账本
        const detail: Array<{ stockLocationId: ID; quantity: number }> = [];
        for (const e of entries) {
            if (e.floor <= 0) continue;
            await this.adjustStockForLocation(
                ctx,
                variantId,
                e.locId as any,
                e.floor,
                `AfterSales#${afterSalesCode}:return-restock`,
                { bizType: 'afterSales', bizCode: afterSalesCode, orderLineId },
            );
            detail.push({ stockLocationId: e.locId as any, quantity: e.floor });
        }
        return detail;
    }

    /**
     * 订单发货记账：core 在 Fulfillment Created→Pending 时创建 Sale 流水（真实扣减 onHand），
     * 本方法在同一事务内为该批 Sale 写入 order:out 账本，保证账实一致（账本口径铁律：只记真实 onHand 变动，
     * 占货 ALLOCATION 不记、超时取消 RELEASE 不记）。
     * 由 inventory.plugin.ts 注册的 StockMovementEvent(SALE) 阻塞事件处理器调用。
     */
    async recordOrderSalesOut(ctx: RequestContext, sales: Sale[]): Promise<void> {
        for (const sale of sales) {
            const orderLineId = sale.orderLine?.id;
            if (orderLineId == null) {
                continue;
            }
            const variantId = sale.productVariant?.id;
            const locationId = sale.stockLocationId ?? sale.stockLocation?.id;
            if (variantId == null || locationId == null) {
                Logger.warn(`Ledger order:out skipped (missing variant/location): orderLine=${orderLineId}`, loggerCtx);
                continue;
            }
            // bizCode 取订单号，便于按单一站式追溯
            let orderCode = `OL${orderLineId}`;
            // 拆单/多仓时 Sale.quantity 为整行数量（上游 Vendure 行为，每仓各记整行），
            // 本仓真实扣减量以订单行 Allocation 记录为准（逐仓数量），单仓时回退整行数量。
            let soldQty = Math.abs(sale.quantity);
            try {
                const orderLine = await this.connection.getRepository(ctx, OrderLine).findOne({
                    where: { id: orderLineId as any },
                    relations: ['order'],
                });
                orderCode = orderLine?.order?.code ?? orderCode;
                const perLocation = await this.connection.getRepository(ctx, Allocation).find({
                    where: { orderLine: { id: orderLineId as any } } as any,
                });
                const allocForLoc = perLocation.find(a => idsAreEqual(a.stockLocationId as any, locationId as any));
                if (allocForLoc != null && allocForLoc.quantity != null) {
                    soldQty = Math.abs(allocForLoc.quantity);
                }
            } catch (e: any) {
                Logger.warn(`Ledger order:out order-code lookup failed: ${e?.message ?? e}`, loggerCtx);
            }
            // publish 发生在扣库之后，读取当前 onHand 作为 afterOnHand 快照（sale.quantity 为负数）
            let beforeOnHand: number | undefined;
            let afterOnHand: number | undefined;
            try {
                afterOnHand = (await this.stockLevelService.getStockLevel(ctx, variantId, locationId)).stockOnHand;
                beforeOnHand = afterOnHand + soldQty;
            } catch {
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
    protected async assertSufficientStock(
        ctx: RequestContext,
        variantId: ID,
        locationId: ID,
        requiredQty: number,
    ): Promise<void> {
        const level = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const available = level.stockOnHand - level.stockAllocated;
        if (available < requiredQty) {
            throw new UserInputError(
                `Insufficient stock for variant ${variantId} at location ${locationId}: ` +
                `required ${requiredQty}, available ${available}`,
            );
        }
    }

    /**
     * 状态转换校验
     */
    protected assertTransition<S extends string>(
        order: { state: S },
        fromState: S,
        toState: S,
        transitions: Record<S, S[]>,
    ): void {
        if (order.state !== fromState) {
            throw new UserInputError(`Invalid state: expected ${fromState}, got ${order.state}`);
        }
        const allowed = transitions[fromState] ?? [];
        if (!allowed.includes(toState)) {
            throw new UserInputError(`Invalid transition: ${fromState} -> ${toState}`);
        }
    }

    /**
     * 生成业务单号（前缀 + 时间戳 + 随机数）
     */
    protected generateCode(prefix: string): string {
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

    async findStockLevels(
        ctx: RequestContext,
        options?: { locationId?: ID; page?: number; pageSize?: number },
    ): Promise<{ items: StockLevel[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const repo = this.connection.getRepository(ctx, StockLevel);
        const qb = repo.createQueryBuilder('level')
            .leftJoinAndSelect('level.productVariant', 'variant')
            .leftJoinAndSelect('level.stockLocation', 'location');

        if (options?.locationId) {
            qb.andWhere('level.stockLocationId = :locationId', { locationId: options.locationId });
        }

        qb.orderBy('level.productVariantId', 'ASC')
          .skip((page - 1) * pageSize)
          .take(pageSize);

        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findStockMovements(
        ctx: RequestContext,
        options?: { productVariantId?: ID; locationId?: ID; type?: string; page?: number; pageSize?: number },
    ): Promise<{ items: any[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const repo = this.connection.rawConnection.getRepository('StockMovement' as any);
        const qb = repo.createQueryBuilder('movement')
            .leftJoinAndSelect('movement.productVariant', 'variant')
            .leftJoinAndSelect('movement.stockLocation', 'location')
            .orderBy('movement.createdAt', 'DESC');

        if (options?.productVariantId) {
            qb.andWhere('movement.productVariantId = :variantId', { variantId: options.productVariantId });
        }
        if (options?.locationId) {
            qb.andWhere('movement.stockLocationId = :locationId', { locationId: options.locationId });
        }
        if (options?.type) {
            qb.andWhere('movement.type = :type', { type: options.type });
        }

        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findStockLocations(
        ctx: RequestContext,
        options?: { page?: number; pageSize?: number },
    ): Promise<{ items: StockLocation[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const result = await this.stockLocationService.findAll(ctx, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return { items: result.items, totalItems: result.totalItems };
    }

    async findStockLedger(
        ctx: RequestContext,
        options?: {
            productVariantId?: ID;
            locationId?: ID;
            bizType?: string;
            bizCode?: string;
            orderLineId?: ID;
            page?: number;
            pageSize?: number;
        },
    ): Promise<{ items: any[]; totalItems: number }> {
        return this.stockLedgerService.list(ctx, options);
    }

    // ===== 多库库存展示 =====

    /**
     * 多库库存展示（就近门店库存）：返回某商品在各仓库/门店的逐仓可售库存 + 距离。
     * - productId 必填；variantId 省略时返回该商品全部 variant。
     * - 带 lat/lng 时按距离升序排序（无坐标为 -1 排末尾）；带 city 时仅保留服务该城市的仓。
     */
    async findNearbyStock(
        ctx: RequestContext,
        options: { productId: ID; variantId?: ID; lat?: number; lng?: number; city?: string },
    ): Promise<Array<{ location: StockLocation; distanceKm: number; variants: Array<{ variantId: ID; variantName: string; sku: string; stockOnHand: number; stockAllocated: number; stockAvailable: number }> }>> {
        // 分页拉取全部仓库（单次列表查询有上限，避免 take 超限报错）
        const pageSize = 100;
        const locations: StockLocation[] = [];
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
        const variantRepo = this.connection.getRepository(ctx, ProductVariant);
        const variants = await variantRepo.find({
            where: options.variantId
                ? { id: options.variantId as any }
                : { product: { id: options.productId as any } } as any,
            relations: ['product'],
        });

        const origin = options.lat != null && options.lng != null
            ? { lat: options.lat, lng: options.lng }
            : null;

        type VariantStock = {
            variantId: ID;
            variantName: string;
            sku: string;
            stockOnHand: number;
            stockAllocated: number;
            stockAvailable: number;
        };
        const rows: Array<{ location: StockLocation; distanceKm: number; variants: VariantStock[] }> = [];
        for (const loc of locations) {
            if (options.city && !this.locationServesCity(loc, options.city)) {
                continue;
            }
            // 带定位时跳过无坐标仓库：无法计算“就近”距离，避免 9e15/INF 干扰结果与前端展示
            if (origin && !this.locationHasCoords(loc)) {
                continue;
            }
            const distanceKm = this.locationDistanceKm(loc, origin);
            const perLocation: VariantStock[] = [];
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

    private locationServesCity(loc: StockLocation, city: string): boolean {
        const serviceCities = (loc.customFields as any)?.serviceCities;
        if (!Array.isArray(serviceCities) || serviceCities.length === 0) {
            return true;
        }
        const norm = (s: string) => s.trim().toLowerCase();
        return serviceCities.some((s: unknown) => {
            if (typeof s !== 'string') return false;
            const a = norm(city);
            const b = norm(s);
            return a === b || a.startsWith(b) || b.startsWith(a);
        });
    }

    private locationHasCoords(loc: StockLocation): boolean {
        const cf = (loc.customFields as any) ?? {};
        const lat = cf.lat != null ? Number(cf.lat) : NaN;
        const lng = cf.lng != null ? Number(cf.lng) : NaN;
        return isFinite(lat) && isFinite(lng);
    }

    private locationDistanceKm(loc: StockLocation, origin: { lat: number; lng: number } | null): number {
        if (!origin) return -1;
        const cf = (loc.customFields as any) ?? {};
        const lat = cf.lat != null ? Number(cf.lat) : NaN;
        const lng = cf.lng != null ? Number(cf.lng) : NaN;
        if (!isFinite(lat) || !isFinite(lng)) return Number.MAX_SAFE_INTEGER;
        return this.haversineKm(origin.lat, origin.lng, lat, lng);
    }

    private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    // ===== 入库单 =====

    async createStockInOrder(
        ctx: RequestContext,
        input: {
            type?: string;
            note?: string;
            targetLocationId: ID;
            lines: Array<{ productVariantId: ID; quantity: number; unitPrice?: number }>;
        },
    ): Promise<StockInOrder> {
        const order = new StockInOrder({
            code: this.generateCode('RKT'),
            state: StockInState.Pending,
            type: input.type,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            targetLocationId: input.targetLocationId,
        });
        order.lines = input.lines.map(l => new StockInOrderLine({
            productVariantId: l.productVariantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice ?? null,
        }));

        const repo = this.connection.getRepository(ctx, StockInOrder);
        return repo.save(order);
    }

    async findStockInOrders(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: StockInOrder[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const repo = this.connection.getRepository(ctx, StockInOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.targetLocation', 'targetLocation')
            .orderBy('order.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneStockInOrder(ctx: RequestContext, id: ID): Promise<StockInOrder | null> {
        const repo = this.connection.getRepository(ctx, StockInOrder);
        return repo.findOne({
            where: { id: id as any },
            relations: ['lines', 'targetLocation'],
        });
    }

    async completeStockInOrder(ctx: RequestContext, id: ID): Promise<StockInOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StockInOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StockInOrder ${id} not found`);

            this.assertTransition(order, StockInState.Pending, StockInState.Completed, STOCK_IN_TRANSITIONS);

            for (const line of order.lines) {
                await this.adjustStockForLocation(
                    txCtx,
                    line.productVariantId,
                    order.targetLocationId,
                    line.quantity,
                    `StockInOrder#${order.code}:inbound`,
                    { bizType: 'stockIn', bizCode: order.code },
                );
            }

            order.state = StockInState.Completed;
            order.completedAt = new Date();
            return repo.save(order);
        });
    }

    async cancelStockInOrder(ctx: RequestContext, id: ID): Promise<StockInOrder> {
        const repo = this.connection.getRepository(ctx, StockInOrder);
        const order = await repo.findOne({ where: { id: id as any } });
        if (!order) throw new UserInputError(`StockInOrder ${id} not found`);

        this.assertTransition(order, StockInState.Pending, StockInState.Cancelled, STOCK_IN_TRANSITIONS);
        order.state = StockInState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }

    // ===== 出库单 =====

    async createStockOutOrder(
        ctx: RequestContext,
        input: {
            type?: string;
            note?: string;
            sourceLocationId: ID;
            lines: Array<{ productVariantId: ID; quantity: number; unitPrice?: number }>;
        },
    ): Promise<StockOutOrder> {
        const order = new StockOutOrder({
            code: this.generateCode('CKT'),
            state: StockOutState.Pending,
            type: input.type,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            sourceLocationId: input.sourceLocationId,
        });
        order.lines = input.lines.map(l => new StockOutOrderLine({
            productVariantId: l.productVariantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice ?? null,
        }));

        const repo = this.connection.getRepository(ctx, StockOutOrder);
        return repo.save(order);
    }

    async findStockOutOrders(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: StockOutOrder[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const repo = this.connection.getRepository(ctx, StockOutOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.sourceLocation', 'sourceLocation')
            .orderBy('order.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneStockOutOrder(ctx: RequestContext, id: ID): Promise<StockOutOrder | null> {
        const repo = this.connection.getRepository(ctx, StockOutOrder);
        return repo.findOne({
            where: { id: id as any },
            relations: ['lines', 'sourceLocation'],
        });
    }

    async completeStockOutOrder(ctx: RequestContext, id: ID): Promise<StockOutOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StockOutOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StockOutOrder ${id} not found`);

            this.assertTransition(order, StockOutState.Pending, StockOutState.Completed, STOCK_OUT_TRANSITIONS);

            // 1. 校验源仓库存充足
            for (const line of order.lines) {
                await this.assertSufficientStock(
                    txCtx, line.productVariantId, order.sourceLocationId, line.quantity,
                );
            }
            // 2. 扣减库存
            for (const line of order.lines) {
                await this.adjustStockForLocation(
                    txCtx,
                    line.productVariantId,
                    order.sourceLocationId,
                    -line.quantity,
                    `StockOutOrder#${order.code}:outbound`,
                    { bizType: 'stockOut', bizCode: order.code },
                );
            }

            order.state = StockOutState.Completed;
            order.completedAt = new Date();
            return repo.save(order);
        });
    }

    async cancelStockOutOrder(ctx: RequestContext, id: ID): Promise<StockOutOrder> {
        const repo = this.connection.getRepository(ctx, StockOutOrder);
        const order = await repo.findOne({ where: { id: id as any } });
        if (!order) throw new UserInputError(`StockOutOrder ${id} not found`);

        this.assertTransition(order, StockOutState.Pending, StockOutState.Cancelled, STOCK_OUT_TRANSITIONS);
        order.state = StockOutState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }

    // ===== 调拨单 =====

    async createStockMoveOrder(
        ctx: RequestContext,
        input: {
            note?: string;
            sourceLocationId: ID;
            targetLocationId: ID;
            lines: Array<{ productVariantId: ID; quantity: number }>;
        },
    ): Promise<StockMoveOrder> {
        if (String(input.sourceLocationId) === String(input.targetLocationId)) {
            throw new UserInputError('Source and target locations cannot be the same');
        }
        const order = new StockMoveOrder({
            code: this.generateCode('DBT'),
            state: StockMoveState.Pending,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            sourceLocationId: input.sourceLocationId,
            targetLocationId: input.targetLocationId,
        });
        order.lines = input.lines.map(l => new StockMoveOrderLine({
            productVariantId: l.productVariantId,
            quantity: l.quantity,
        }));

        const repo = this.connection.getRepository(ctx, StockMoveOrder);
        return repo.save(order);
    }

    async findStockMoveOrders(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: StockMoveOrder[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const repo = this.connection.getRepository(ctx, StockMoveOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.sourceLocation', 'sourceLocation')
            .leftJoinAndSelect('order.targetLocation', 'targetLocation')
            .orderBy('order.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder | null> {
        const repo = this.connection.getRepository(ctx, StockMoveOrder);
        return repo.findOne({
            where: { id: id as any },
            relations: ['lines', 'sourceLocation', 'targetLocation'],
        });
    }

    /**
     * Pending → InTransit：源仓出库（扣减）
     */
    async shipStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StockMoveOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StockMoveOrder ${id} not found`);

            this.assertTransition(order, StockMoveState.Pending, StockMoveState.InTransit, STOCK_MOVE_TRANSITIONS);

            for (const line of order.lines) {
                await this.assertSufficientStock(
                    txCtx, line.productVariantId, order.sourceLocationId, line.quantity,
                );
            }
            for (const line of order.lines) {
                await this.adjustStockForLocation(
                    txCtx, line.productVariantId, order.sourceLocationId,
                    -line.quantity,
                    `StockMoveOrder#${order.code}:source-out`,
                    { bizType: 'stockMove', bizCode: order.code, otherLocationId: order.targetLocationId },
                );
            }

            order.state = StockMoveState.InTransit;
            order.shippedAt = new Date();
            return repo.save(order);
        });
    }

    /**
     * InTransit → Received：目的仓入库（增加）
     */
    async receiveStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StockMoveOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StockMoveOrder ${id} not found`);

            this.assertTransition(order, StockMoveState.InTransit, StockMoveState.Received, STOCK_MOVE_TRANSITIONS);

            for (const line of order.lines) {
                await this.adjustStockForLocation(
                    txCtx, line.productVariantId, order.targetLocationId,
                    +line.quantity,
                    `StockMoveOrder#${order.code}:target-in`,
                    { bizType: 'stockMove', bizCode: order.code, otherLocationId: order.sourceLocationId },
                );
            }

            order.state = StockMoveState.Received;
            order.receivedAt = new Date();
            return repo.save(order);
        });
    }

    /**
     * Received → Completed：仅状态变更
     */
    async completeStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder> {
        const repo = this.connection.getRepository(ctx, StockMoveOrder);
        const order = await repo.findOne({ where: { id: id as any } });
        if (!order) throw new UserInputError(`StockMoveOrder ${id} not found`);

        this.assertTransition(order, StockMoveState.Received, StockMoveState.Completed, STOCK_MOVE_TRANSITIONS);
        order.state = StockMoveState.Completed;
        order.completedAt = new Date();
        return repo.save(order);
    }

    /**
     * Pending/InTransit → Cancelled
     * - Pending 态：无库存操作
     * - InTransit 态：回滚源仓（加回去）
     */
    async cancelStockMoveOrder(ctx: RequestContext, id: ID): Promise<StockMoveOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StockMoveOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StockMoveOrder ${id} not found`);

            if (![StockMoveState.Pending, StockMoveState.InTransit].includes(order.state)) {
                throw new UserInputError(`Cannot cancel stock move order in state: ${order.state}`);
            }

            if (order.state === StockMoveState.InTransit) {
                for (const line of order.lines) {
                    await this.adjustStockForLocation(
                        txCtx, line.productVariantId, order.sourceLocationId,
                        +line.quantity,
                        `StockMoveOrder#${order.code}:rollback-source`,
                        { bizType: 'stockMove', bizCode: order.code, otherLocationId: order.targetLocationId },
                    );
                }
            }

            order.state = StockMoveState.Cancelled;
            order.cancelledAt = new Date();
            return repo.save(order);
        });
    }

    // ===== 盘点单 =====

    async createStocktakeOrder(
        ctx: RequestContext,
        input: {
            note?: string;
            locationId: ID;
            productVariantIds: ID[];
        },
    ): Promise<StocktakeOrder> {
        const order = new StocktakeOrder({
            code: this.generateCode('PDT'),
            state: StocktakeState.Pending,
            note: input.note,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            locationId: input.locationId,
        });
        order.lines = input.productVariantIds.map(vid => new StocktakeOrderLine({
            productVariantId: vid,
            systemQuantity: 0,
            countedQuantity: 0,
            difference: 0,
            reconciled: false,
        }));

        const repo = this.connection.getRepository(ctx, StocktakeOrder);
        return repo.save(order);
    }

    async findStocktakeOrders(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: StocktakeOrder[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const repo = this.connection.getRepository(ctx, StocktakeOrder);
        const qb = repo.createQueryBuilder('order')
            .leftJoinAndSelect('order.lines', 'lines')
            .leftJoinAndSelect('order.location', 'location')
            .orderBy('order.createdAt', 'DESC');

        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneStocktakeOrder(ctx: RequestContext, id: ID): Promise<StocktakeOrder | null> {
        const repo = this.connection.getRepository(ctx, StocktakeOrder);
        return repo.findOne({
            where: { id: id as any },
            relations: ['lines', 'location'],
        });
    }

    /**
     * Pending → Counting：快照 systemQuantity
     */
    async startCountingStocktake(ctx: RequestContext, id: ID): Promise<StocktakeOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StocktakeOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StocktakeOrder ${id} not found`);

            this.assertTransition(order, StocktakeState.Pending, StocktakeState.Counting, STOCKTAKE_TRANSITIONS);

            for (const line of order.lines) {
                const level = await this.stockLevelService.getStockLevel(
                    txCtx, line.productVariantId, order.locationId,
                );
                line.systemQuantity = level.stockOnHand;
            }

            order.state = StocktakeState.Counting;
            order.countingStartedAt = new Date();
            return repo.save(order);
        });
    }

    /**
     * Counting → Reconciling：录入 countedQuantity，计算 difference
     */
    async submitStocktakeCount(
        ctx: RequestContext,
        id: ID,
        counts: Array<{ lineId: ID; countedQuantity: number }>,
    ): Promise<StocktakeOrder> {
        const repo = this.connection.getRepository(ctx, StocktakeOrder);
        const order = await repo.findOne({
            where: { id: id as any },
            relations: ['lines'],
        });
        if (!order) throw new UserInputError(`StocktakeOrder ${id} not found`);
        this.assertTransition(order, StocktakeState.Counting, StocktakeState.Reconciling, STOCKTAKE_TRANSITIONS);

        for (const count of counts) {
            const line = order.lines.find(l => String(l.id) === String(count.lineId));
            if (!line) throw new UserInputError(`Line ${count.lineId} not found in order ${id}`);
            line.countedQuantity = count.countedQuantity;
            line.difference = count.countedQuantity - line.systemQuantity;
        }

        order.state = StocktakeState.Reconciling;
        order.reconcilingStartedAt = new Date();
        return repo.save(order);
    }

    /**
     * 审核单行（标记 reconciled = true）
     */
    async reconcileStocktakeLine(
        ctx: RequestContext,
        orderId: ID,
        lineId: ID,
    ): Promise<StocktakeOrder> {
        const repo = this.connection.getRepository(ctx, StocktakeOrder);
        const order = await repo.findOne({
            where: { id: orderId as any },
            relations: ['lines'],
        });
        if (!order) throw new UserInputError(`StocktakeOrder ${orderId} not found`);
        if (order.state !== StocktakeState.Reconciling) {
            throw new UserInputError(`Cannot reconcile line in state: ${order.state}`);
        }

        const line = order.lines.find(l => String(l.id) === String(lineId));
        if (!line) throw new UserInputError(`Line ${lineId} not found in order ${orderId}`);
        line.reconciled = true;
        return repo.save(order);
    }

    /**
     * Reconciling → Completed：对每行 reconciled=true 的行应用差异调整
     */
    async completeStocktakeOrder(ctx: RequestContext, id: ID): Promise<StocktakeOrder> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, StocktakeOrder);
            const order = await repo.findOne({
                where: { id: id as any },
                relations: ['lines'],
            });
            if (!order) throw new UserInputError(`StocktakeOrder ${id} not found`);

            this.assertTransition(order, StocktakeState.Reconciling, StocktakeState.Completed, STOCKTAKE_TRANSITIONS);

            const unReconciled = order.lines.filter(l => !l.reconciled);
            if (unReconciled.length > 0) {
                throw new UserInputError(`${unReconciled.length} lines not reconciled`);
            }

            for (const line of order.lines) {
                if (line.difference !== 0) {
                    await this.adjustStockForLocation(
                        txCtx, line.productVariantId, order.locationId,
                        line.difference,
                        `StocktakeOrder#${order.code}:reconcile`,
                        { bizType: 'stocktake', bizCode: order.code },
                    );
                }
            }

            order.state = StocktakeState.Completed;
            order.completedAt = new Date();
            return repo.save(order);
        });
    }

    async cancelStocktakeOrder(ctx: RequestContext, id: ID): Promise<StocktakeOrder> {
        const repo = this.connection.getRepository(ctx, StocktakeOrder);
        const order = await repo.findOne({ where: { id: id as any } });
        if (!order) throw new UserInputError(`StocktakeOrder ${id} not found`);

        if (![StocktakeState.Pending, StocktakeState.Counting].includes(order.state)) {
            throw new UserInputError(`Cannot cancel stocktake order in state: ${order.state}`);
        }

        order.state = StocktakeState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }

    // ===== 供应商档案 =====

    private async assertSupplierCodeUnique(ctx: RequestContext, code: string, excludeId?: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, Supplier);
        const existing = await repo.createQueryBuilder('s')
            .andWhere('s.code = :code', { code })
            .andWhere(excludeId ? 's.id != :excludeId' : '1=1', excludeId ? { excludeId } : {})
            .getOne();
        if (existing) {
            throw new UserInputError(`Supplier code already exists: ${code}`);
        }
    }

    async createSupplier(
        ctx: RequestContext,
        input: {
            code: string;
            name: string;
            taxNumber?: string;
            contactName?: string;
            contactPhone?: string;
            address?: string;
            settlementDays?: number;
            note?: string;
        },
    ): Promise<Supplier> {
        if (!input.code || !input.name) {
            throw new UserInputError('Supplier code and name are required');
        }
        await this.assertSupplierCodeUnique(ctx, input.code);
        const supplier = new Supplier({
            code: input.code,
            name: input.name,
            taxNumber: input.taxNumber ?? null,
            contactName: input.contactName ?? null,
            contactPhone: input.contactPhone ?? null,
            address: input.address ?? null,
            settlementDays: input.settlementDays ?? 0,
            note: input.note ?? null,
            channelId: ctx.channelId as number,
        });
        supplier.channels = [ctx.channel];
        return this.connection.getRepository(ctx, Supplier).save(supplier);
    }

    async updateSupplier(ctx: RequestContext, id: ID, input: any): Promise<Supplier> {
        const repo = this.connection.getRepository(ctx, Supplier);
        const supplier = await repo.findOne({ where: { id: id as any } });
        if (!supplier) throw new UserInputError(`Supplier ${id} not found`);
        if (input.code != null && input.code !== supplier.code) {
            await this.assertSupplierCodeUnique(ctx, input.code, id);
            supplier.code = input.code;
        }
        if (input.name != null) supplier.name = input.name;
        if (input.taxNumber != null) supplier.taxNumber = input.taxNumber;
        if (input.contactName != null) supplier.contactName = input.contactName;
        if (input.contactPhone != null) supplier.contactPhone = input.contactPhone;
        if (input.address != null) supplier.address = input.address;
        if (input.settlementDays != null) supplier.settlementDays = input.settlementDays;
        if (input.note != null) supplier.note = input.note;
        return repo.save(supplier);
    }

    async deleteSupplier(ctx: RequestContext, id: ID): Promise<boolean> {
        // 删除前置校验：已有采购单的供应商禁止删除
        const purchaseRepo = this.connection.getRepository(ctx, PurchaseOrder);
        const linked = await purchaseRepo.count({ where: { supplierId: id as any } });
        if (linked > 0) {
            throw new UserInputError(`Supplier ${id} has ${linked} purchase order(s), cannot delete`);
        }
        await this.connection.getRepository(ctx, Supplier).delete({ id: id as any });
        return true;
    }

    async findSuppliers(
        ctx: RequestContext,
        options?: { keyword?: string; page?: number; pageSize?: number },
    ): Promise<{ items: Supplier[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const qb = this.connection.getRepository(ctx, Supplier)
            .createQueryBuilder('s')
            .andWhere('s.channelId = :channelId', { channelId: ctx.channelId as number })
            .orderBy('s.createdAt', 'DESC');
        if (options?.keyword) {
            qb.andWhere('(s.name LIKE :kw OR s.code LIKE :kw OR s.taxNumber LIKE :kw)', {
                kw: `%${options.keyword}%`,
            });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOneSupplier(ctx: RequestContext, id: ID): Promise<Supplier | null> {
        return this.connection.getRepository(ctx, Supplier).findOne({ where: { id: id as any } });
    }

    // ===== 采购单 =====

    async createPurchaseOrder(
        ctx: RequestContext,
        input: {
            supplierId: ID;
            targetLocationId: ID;
            note?: string;
            orderDate?: Date;
            expectedArrivalDate?: Date;
            lines: Array<{ productVariantId: ID; quantity: number; unitPrice?: number }>;
        },
    ): Promise<PurchaseOrder> {
        if (!input.lines || input.lines.length === 0) {
            throw new UserInputError('Purchase order requires at least one line');
        }
        for (const l of input.lines) {
            if (!l.quantity || l.quantity <= 0) {
                throw new UserInputError('Line quantity must be positive');
            }
        }
        const supplierRepo = this.connection.getRepository(ctx, Supplier);
        const supplier = await supplierRepo.findOne({ where: { id: input.supplierId as any } });
        if (!supplier) throw new UserInputError(`Supplier ${input.supplierId} not found`);

        const order = new PurchaseOrder({
            code: this.generateCode('CG'),
            state: PurchaseOrderState.Draft,
            supplierId: input.supplierId,
            targetLocationId: input.targetLocationId,
            note: input.note ?? null,
            staffId: ctx.activeUserId ? String(ctx.activeUserId) : null,
            orderDate: input.orderDate ?? new Date(),
            expectedArrivalDate: input.expectedArrivalDate ?? null,
            channelId: ctx.channelId as number,
        });
        order.lines = input.lines.map(l => new PurchaseOrderLine({
            productVariantId: l.productVariantId,
            quantity: l.quantity,
            receivedQuantity: 0,
            unitPrice: l.unitPrice ?? null,
        }));
        order.totalAmount = order.lines.reduce((s, l) => s + l.amount, 0);
        order.channels = [ctx.channel];
        return this.connection.getRepository(ctx, PurchaseOrder).save(order);
    }

    async findPurchaseOrders(
        ctx: RequestContext,
        options?: { state?: string; page?: number; pageSize?: number },
    ): Promise<{ items: PurchaseOrder[]; totalItems: number }> {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 20;
        const qb = this.connection.getRepository(ctx, PurchaseOrder)
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.supplier', 'supplier')
            .leftJoinAndSelect('order.targetLocation', 'targetLocation')
            .leftJoinAndSelect('order.lines', 'lines')
            .andWhere('order.channelId = :channelId', { channelId: ctx.channelId as number })
            .orderBy('order.createdAt', 'DESC');
        if (options?.state) {
            qb.andWhere('order.state = :state', { state: options.state });
        }
        qb.skip((page - 1) * pageSize).take(pageSize);
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOnePurchaseOrder(ctx: RequestContext, id: ID): Promise<PurchaseOrder | null> {
        return this.connection.getRepository(ctx, PurchaseOrder).findOne({
            where: { id: id as any },
            relations: ['lines', 'supplier', 'targetLocation'],
        });
    }

    async placePurchaseOrder(ctx: RequestContext, id: ID): Promise<PurchaseOrder> {
        const repo = this.connection.getRepository(ctx, PurchaseOrder);
        const order = await repo.findOne({ where: { id: id as any }, relations: ['lines'] });
        if (!order) throw new UserInputError(`PurchaseOrder ${id} not found`);
        this.assertTransition(order, PurchaseOrderState.Draft, PurchaseOrderState.Ordered, PURCHASE_ORDER_TRANSITIONS);
        order.state = PurchaseOrderState.Ordered;
        order.orderedAt = new Date();
        return repo.save(order);
    }

    /**
     * 分批收货：deltas 为本次实收增量 [{ lineId, quantity }]，累加 receivedQuantity，
     * 单行超收/负数校验，全部收满 → Received，未收满 → PartiallyReceived。
     * 每行按增量对 targetLocation 调库(+delta) 并写 purchase 账本。
     */
    async receivePurchaseOrder(ctx: RequestContext, id: ID, deltas: Array<{ lineId: ID; quantity: number }>): Promise<PurchaseOrder> {
        if (!deltas || deltas.length === 0) {
            throw new UserInputError('Receive requires at least one line');
        }
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, PurchaseOrder);
            const order = await repo.findOne({ where: { id: id as any }, relations: ['lines'] });
            if (!order) throw new UserInputError(`PurchaseOrder ${id} not found`);
            if (![PurchaseOrderState.Ordered, PurchaseOrderState.PartiallyReceived].includes(order.state)) {
                throw new UserInputError(`Cannot receive purchase order in state: ${order.state}`);
            }

            let allFilled = true;
            for (const d of deltas) {
                if (!d.quantity || d.quantity <= 0) {
                    throw new UserInputError(`Receive quantity for line ${d.lineId} must be positive`);
                }
                const line = order.lines.find(l => String(l.id) === String(d.lineId));
                if (!line) throw new UserInputError(`Line ${d.lineId} not found in order ${id}`);
                const newReceived = line.receivedQuantity + d.quantity;
                if (newReceived > line.quantity) {
                    throw new UserInputError(
                        `Line ${d.lineId} over-received: ordered ${line.quantity}, received would be ${newReceived}`,
                    );
                }
                // 调库 + 写 purchase 账本
                await this.adjustStockForLocation(
                    txCtx,
                    line.productVariantId,
                    order.targetLocationId,
                    d.quantity,
                    `PurchaseOrder#${order.code}:purchase-in`,
                    { bizType: 'purchase', bizCode: order.code },
                );
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

            order.state = allFilled ? PurchaseOrderState.Received : PurchaseOrderState.PartiallyReceived;
            return repo.save(order);
        });
    }

    async completePurchaseOrder(ctx: RequestContext, id: ID): Promise<PurchaseOrder> {
        const repo = this.connection.getRepository(ctx, PurchaseOrder);
        const order = await repo.findOne({ where: { id: id as any } });
        if (!order) throw new UserInputError(`PurchaseOrder ${id} not found`);
        this.assertTransition(order, PurchaseOrderState.Received, PurchaseOrderState.Completed, PURCHASE_ORDER_TRANSITIONS);
        order.state = PurchaseOrderState.Completed;
        order.completedAt = new Date();
        return repo.save(order);
    }

    async cancelPurchaseOrder(ctx: RequestContext, id: ID): Promise<PurchaseOrder> {
        const repo = this.connection.getRepository(ctx, PurchaseOrder);
        const order = await repo.findOne({ where: { id: id as any } });
        if (!order) throw new UserInputError(`PurchaseOrder ${id} not found`);
        if (![PurchaseOrderState.Draft, PurchaseOrderState.Ordered].includes(order.state)) {
            throw new UserInputError(`Cannot cancel purchase order in state: ${order.state}`);
        }
        order.state = PurchaseOrderState.Cancelled;
        order.cancelledAt = new Date();
        return repo.save(order);
    }

    // ===== 店主自营库存（阶段47）：只读水位 + 归属校验下绝对量校准，复用平台账本封装 =====

    /**
     * 归属解析（与 shop-plugin 阶段18 账权同口径）：activeUserId → Administrator → Shop.administratorId。
     * 不注入 ShopService（跨插件模块不可注入），依核心服务/仓储复刻 resolveMyShopFromActiveUser + requireMyShop。
     */
    private async requireMyShop(ctx: RequestContext): Promise<Shop> {
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null) {
            throw new ForbiddenError();
        }
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { administratorId: admin.id as number } as any });
        if (!shop || shop.status !== 'active') {
            throw new ForbiddenError();
        }
        return shop;
    }

    /** 校验商品归属本人店铺（Product.customFields.shopId === 我的 shopId）；否则 Forbidden。 */
    private async assertMyProduct(ctx: RequestContext, productId: ID, shopId: number): Promise<void> {
        const product = await this.connection
            .getRepository(ctx, Product)
            .findOne({ where: { id: productId as any as number } as any });
        if (!product || (product.customFields as any)?.shopId !== shopId) {
            throw new ForbiddenError();
        }
    }

    /**
     * 店主只读水位：本人店铺某商品的逐仓库存（含可售/占用）。
     * 归属：先校验商品属于本人店铺（Product.customFields.shopId === 我的 shopId）。
     */
    async getMyShopStock(
        ctx: RequestContext,
        productId: ID,
    ): Promise<Array<{ variantId: ID; variantName: string | null; sku: string | null; locations: any[] }>> {
        const shop = await this.requireMyShop(ctx);
        await this.assertMyProduct(ctx, productId, shop.id as number);

        const variantRepo = this.connection.getRepository(ctx, ProductVariant);
        const variants = await variantRepo.find({
            where: { product: { id: productId as any as number } } as any,
        });

        // 分页拉取全部仓库（单次列表查询有上限）
        const pageSize = 100;
        const locations: StockLocation[] = [];
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

        const rows: Array<{ variantId: ID; variantName: string; sku: string | null; locations: any[] }> = [];
        for (const v of variants) {
            const locationsRow: any[] = [];
            for (const loc of locations) {
                const level = await this.stockLevelService.getStockLevel(ctx, v.id, loc.id);
                locationsRow.push({
                    locationId: loc.id,
                    locationName: loc.name,
                    stockOnHand: level.stockOnHand,
                    stockAllocated: level.stockAllocated,
                    stockAvailable: level.stockOnHand - level.stockAllocated,
                });
            }
            rows.push({ variantId: v.id, variantName: (v.name as any) ?? null, sku: v.sku ?? null, locations: locationsRow });
        }
        return rows;
    }

    /**
     * 店主库存绝对量校准：对本人店铺商品某 variant 在某位置置为目标水位（delta=目标-当前），写 manual 账本。
     * 归属：先校验 variant 所属商品属于本人店铺，避免越权调他人店铺商品。
     */
    async adjustMyShopStock(
        ctx: RequestContext,
        variantId: ID,
        stockLocationId: ID,
        stockOnHand: number,
    ): Promise<boolean> {
        const shop = await this.requireMyShop(ctx);
        if (stockOnHand < 0) {
            throw new UserInputError('stockOnHand must be >= 0');
        }

        const variant = await this.connection
            .getRepository(ctx, ProductVariant)
            .findOne({ where: { id: variantId as any as number } as any, relations: ['product'] });
        if (!variant) {
            throw new UserInputError(`ProductVariant ${variantId} not found`);
        }
        await this.assertMyProduct(ctx, variant.product.id, shop.id as number);

        const current = await this.stockLevelService.getStockLevel(ctx, variantId, stockLocationId);
        const delta = stockOnHand - current.stockOnHand;
        if (delta === 0) {
            return true;
        }
        await this.adjustStockForLocation(ctx, variantId, stockLocationId, delta, `MyShop#${shop.slug}:manual-adjust`, {
            bizType: 'manual',
            bizCode: `MyShop-${shop.slug}`,
        });
        return true;
    }

    /**
     * 店主商品库存聚合查看：本人店铺某商品的变体数 + 全仓全变体合计 inHand / available。
     * 归属：先校验商品属于本人店铺。作为 myShopStock（逐仓逐变体明细）的列表级聚合汇总。
     */
    async myShopProductStock(
        ctx: RequestContext,
        productId: ID,
    ): Promise<{ productId: ID; variantCount: number; totalOnHand: number; totalAvailable: number }> {
        const shop = await this.requireMyShop(ctx);
        await this.assertMyProduct(ctx, productId, shop.id as number);

        const variants = await this.connection.getRepository(ctx, ProductVariant).find({
            where: { product: { id: productId as any as number } } as any,
        });

        // 分页拉取全部仓库（单次列表查询有上限）
        const pageSize = 100;
        const locations: StockLocation[] = [];
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

        let totalOnHand = 0;
        let totalAvailable = 0;
        for (const v of variants) {
            for (const loc of locations) {
                const level = await this.stockLevelService.getStockLevel(ctx, v.id, loc.id);
                totalOnHand += level.stockOnHand;
                totalAvailable += level.stockOnHand - level.stockAllocated;
            }
        }
        return { productId, variantCount: variants.length, totalOnHand, totalAvailable };
    }
}
