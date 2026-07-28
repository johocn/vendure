// e:\code\vendure\packages\inventory-plugin\src\inventory.service.ts
import { Injectable } from '@nestjs/common';
import { ID } from '@vendure/common/lib/shared-types';
import {
    Logger,
    RequestContext,
    StockAdjustment,
    StockLevel,
    StockLevelService,
    StockLocationService,
    StockMovementService,
    StockLocation,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import {
    STOCK_IN_TRANSITIONS,
    STOCK_OUT_TRANSITIONS,
    STOCK_MOVE_TRANSITIONS,
    STOCKTAKE_TRANSITIONS,
    StockInState,
    StockOutState,
    StockMoveState,
    StocktakeState,
} from './constants';
import { StockInOrder, StockInOrderLine } from './entities/stock-in-order.entity';
import { StockOutOrder, StockOutOrderLine } from './entities/stock-out-order.entity';
import { StockMoveOrder, StockMoveOrderLine } from './entities/stock-move-order.entity';
import { StocktakeOrder, StocktakeOrderLine } from './entities/stocktake-order.entity';

const loggerCtx = 'InventoryService';

@Injectable()
export class InventoryService {
    constructor(
        private connection: TransactionalConnection,
        private stockMovementService: StockMovementService,
        private stockLevelService: StockLevelService,
        private stockLocationService: StockLocationService,
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
    ): Promise<void> {
        const current = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        const newOnHand = current.stockOnHand + delta;
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
        Logger.info(`Stock adjusted: variant=${variantId} location=${locationId} delta=${delta} reason=${reason}`, loggerCtx);
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
}
