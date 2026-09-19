import { Injectable } from '@nestjs/common';
import {
    EventBus,
    ID,
    Logger,
    OrderLine,
    RequestContext,
    StockLevelService,
    StockLocation,
    StockMovementEvent,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';
import { StockReservationEntity } from './stock-reservation.entity';
import { FulfillType, StockReservationItemEntity } from './stock-reservation-item.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';

const loggerCtx = 'StockReservationService';

export interface ReservationSplit {
    locationId: ID;
    fulfillType: FulfillType;
    qty: number;
}

/**
 * 多仓拆分发货预留单：
 * - reserveOnOrder：下单预占（Order/DeliveryType 归一），建头单 PENDING_ALLOC
 * - allocate：逐仓拆分 item，守恒校验 + 单仓物理 onHand 校验，头→ALLOCATED
 * - fulfill：核销/发货（扣物理仓由 Vendure core 在 SALE 时完成），item→DONE，全 DONE→头 DONE
 * - release：取消/退款对称释放，头→RELEASED
 * - reconcileScan：对账 Σ物理 − 虚拟 == ΣPENDING item qty
 *
 * 接线：事件托盘复用 virtual-physical-stock.service 的 StockMovementEvent 链路——
 * ALLOCATION=下单预占、SALE=发货/自提核销、CANCELLATION/RELEASE=取消/退款。
 */
@Injectable()
export class StockReservationService {
    constructor(
        private conn: TransactionalConnection,
        private stockLevelService: StockLevelService,
        private virtualPhysicalStockService: VirtualPhysicalStockService,
        private eventBus: EventBus,
    ) {}

    // ---- 基础读写 ----

    private repo(ctx: RequestContext) {
        return this.conn.getRepository(ctx, StockReservationEntity);
    }

    private itemRepo(ctx: RequestContext) {
        return this.conn.getRepository(ctx, StockReservationItemEntity);
    }

    async get(ctx: RequestContext, id: number): Promise<StockReservationEntity> {
        const res = await this.repo(ctx).findOne({ where: { id } });
        if (!res) {
            throw new Error(`预留单不存在: ${id}`);
        }
        return res;
    }

    async findByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<StockReservationEntity | null> {
        return this.repo(ctx).findOne({ where: { orderLineId: Number(orderLineId) } });
    }

    async items(ctx: RequestContext, reservationId: number): Promise<StockReservationItemEntity[]> {
        return this.itemRepo(ctx).find({ where: { reservationId } });
    }

    // ---- 生命周期 ----

    /** 下单预占：建头单 PENDING_ALLOC（幂等：同一 orderLine+variant 复用）。虚拟 allocation 由 core 下单流程完成，此处仅记账。 */
    async reserveOnOrder(
        ctx: RequestContext,
        orderId: ID,
        orderLineId: ID,
        variantId: ID,
        totalQty: number,
    ): Promise<StockReservationEntity> {
        const existing = await this.repo(ctx).findOne({
            where: { orderLineId: Number(orderLineId), variantId: Number(variantId) },
        });
        if (existing) {
            existing.totalQty = totalQty;
            existing.status = 'PENDING_ALLOC';
            return this.repo(ctx).save(existing);
        }
        const res = new StockReservationEntity();
        res.orderId = Number(orderId);
        res.orderLineId = Number(orderLineId);
        res.variantId = Number(variantId);
        res.totalQty = totalQty;
        res.status = 'PENDING_ALLOC';
        res.tenantChannelId = ctx.channel.code;
        res.createdAt = new Date();
        return this.repo(ctx).save(res);
    }

    /** 备货拆分：重建 item（幂等），守恒校验 Σqty==totalQty、每仓 qty≤物理 onHand，头→ALLOCATED */
    async allocate(ctx: RequestContext, reservationId: number, splits: ReservationSplit[]): Promise<StockReservationEntity> {
        const res = await this.get(ctx, reservationId);
        const sum = splits.reduce((s, x) => s + x.qty, 0);
        if (sum !== res.totalQty) {
            throw new Error(`拆分总量(${sum})≠预占(${res.totalQty})`);
        }
        await this.itemRepo(ctx).delete({ reservationId: res.id });
        for (const s of splits) {
            const level = await this.stockLevelService.getStockLevel(ctx, res.variantId as ID, s.locationId);
            if (s.qty > level.stockOnHand) {
                throw new Error(`仓库${s.locationId}物理库存不足(${level.stockOnHand}<${s.qty})`);
            }
            const item = new StockReservationItemEntity();
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
    async fulfill(ctx: RequestContext, reservationId: number, itemId: number, quantity?: number): Promise<StockReservationItemEntity> {
        const item = await this.itemRepo(ctx).findOne({ where: { id: itemId } });
        if (!item) {
            throw new Error(`预留明细不存在: ${itemId}`);
        }
        const qty = quantity ?? item.qty;
        item.qty = Math.max(0, item.qty - qty);
        if (item.qty <= 0) {
            item.qty = 0;
            item.status = 'DONE';
        }
        const saved = await this.itemRepo(ctx).save(item);

        const pending = await this.itemRepo(ctx).count({ where: { reservationId, status: 'PENDING' } });
        if (pending === 0) {
            const res = await this.get(ctx, reservationId);
            if (res.status !== 'RELEASED') {
                res.status = 'DONE';
                await this.repo(ctx).save(res);
            }
        }
        return saved;
    }

    /** 取消/退款：对称释放。returnPhysical=true 时对已出库 DONE 明细回补物理仓（默认 false，core 的 CANCELLATION/RELEASE 已回补）。 */
    async release(
        ctx: RequestContext,
        reservationId: number,
        options: { returnPhysical?: boolean } = {},
    ): Promise<StockReservationEntity> {
        const res = await this.get(ctx, reservationId);
        if (res.status === 'RELEASED' || res.status === 'DONE') {
            return res;
        }
        const items = await this.items(ctx, reservationId);
        if (options.returnPhysical) {
            for (const done of items.filter(i => i.status === 'DONE')) {
                await this.virtualPhysicalStockService.adjustPhysicalStock(
                    ctx,
                    res.variantId as ID,
                    done.stockLocationId,
                    done.qty,
                    `预留单释放回补:${res.id}`,
                );
            }
        }
        res.status = 'RELEASED';
        return this.repo(ctx).save(res);
    }

    // ---- 对账 ----

    /** 对账恒等式：Σ物理 − 虚拟 == ΣPENDING item qty（按变体，渠道内） */
    async reconcileScan(ctx: RequestContext): Promise<
        Array<{ variantId: number; physicalSum: number; virtualSum: number; pendingQty: number; diff: number }>
    > {
        const pendingItems = await this.itemRepo(ctx).find({ where: { status: 'PENDING' } });
        if (!pendingItems.length) {
            return [];
        }
        const resIds = pendingItems.map(i => i.reservationId);
        const reservations = await this.repo(ctx).find({ where: { id: In(resIds) } });
        const tenant = ctx.channel.code;
        const tenanted = reservations.filter(
            r => r.tenantChannelId == null || r.tenantChannelId === tenant,
        );
        const resById = new Map(tenanted.map(r => [r.id, r]));

        const group = new Map<number, { variantId: number; pendingQty: number }>();
        for (const it of pendingItems) {
            const res = resById.get(it.reservationId);
            if (!res) {
                continue;
            }
            const g = group.get(res.variantId) ?? { variantId: res.variantId, pendingQty: 0 };
            g.pendingQty += it.qty;
            group.set(res.variantId, g);
        }
        if (!group.size) {
            return [];
        }

        const locs = await this.conn.getRepository(ctx, StockLocation).find({ loadEagerRelations: false });
        const kindByLoc = new Map<string, string>();
        for (const l of locs) {
            kindByLoc.set(String(l.id), String((l.customFields as any)?.kind ?? 'virtual'));
        }

        const diffs: Array<{ variantId: number; physicalSum: number; virtualSum: number; pendingQty: number; diff: number }> = [];
        for (const g of group.values()) {
            const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, g.variantId as ID);
            let physical = 0;
            let virtual = 0;
            for (const lv of levels) {
                const kind = kindByLoc.get(String(lv.stockLocationId)) ?? 'virtual';
                if (kind === 'physical') {
                    physical += lv.stockOnHand;
                } else {
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

    registerOrderHandlers(): void {
        this.eventBus.ofType(StockMovementEvent).subscribe(async event => {
            const movements = event.stockMovements ?? [];
            const type = movements[0]?.type;
            try {
                if (type === 'ALLOCATION') {
                    await this.onAllocation(event.ctx, movements as any[]);
                } else if (type === 'SALE') {
                    await this.onSale(event.ctx, movements as any[]);
                } else if (type === 'CANCELLATION' || type === 'RELEASE') {
                    await this.onRelease(event.ctx, movements as any[]);
                }
            } catch (e: any) {
                Logger.warn(`预留单事件处理失败(${type}): ${e.message}`, loggerCtx);
            }
        });
    }

    /** ALLOCATION=下单预占：按 orderLine 聚合成头单 + 逐仓拆分（配送方式决定 fulfillType） */
    private async onAllocation(ctx: RequestContext, movements: any[]): Promise<void> {
        const groups = new Map<string, any[]>();
        for (const m of movements) {
            const lineId = String((m.orderLine as any)?.id ?? '');
            if (!lineId) {
                continue;
            }
            const list = groups.get(lineId) ?? [];
            list.push(m);
            groups.set(lineId, list);
        }
        for (const [lineId, allocs] of groups.entries()) {
            try {
                const orderLine = await this.conn.getRepository(ctx, OrderLine).findOne({
                    where: { id: Number(lineId) as any },
                    relations: ['order'],
                });
                if (!orderLine) {
                    continue;
                }
                const variantId = (allocs[0].productVariant as any)?.id ?? (allocs[0] as any).productVariantId;
                const totalQty = allocs.reduce((s, a) => s + a.quantity, 0);
                const orderId = (orderLine.order as any)?.id ?? (allocs[0] as any).orderId;
                if (variantId == null) {
                    continue;
                }
                const res = await this.reserveOnOrder(ctx, orderId, lineId, variantId, totalQty);
                const deliveryType = (orderLine.order as any)?.customFields?.deliveryType;
                const fulfillType: FulfillType = deliveryType === 'pickup' ? 'CLICK_COLLECT' : 'SHIP';
                const splits: ReservationSplit[] = allocs.map(a => ({
                    locationId: a.stockLocationId,
                    fulfillType,
                    qty: a.quantity,
                }));
                await this.allocate(ctx, res.id, splits);
            } catch (e: any) {
                Logger.warn(`下单预留失败(orderLine=${lineId}): ${e.message}`, loggerCtx);
            }
        }
    }

    /** SALE=发货/自提核销：按 orderLine+location 命中预留明细并核销（物理扣减 core 已完成，仅记账） */
    private async onSale(ctx: RequestContext, movements: any[]): Promise<void> {
        for (const sale of movements) {
            try {
                const lineId = String((sale.orderLine as any)?.id ?? '');
                const locId = sale.stockLocationId;
                const qty = Math.abs(sale.quantity ?? 0);
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
                await this.fulfill(ctx, res.id, item.id, qty);
            } catch (e: any) {
                Logger.warn(`发货核销预留失败: ${e.message}`, loggerCtx);
            }
        }
    }

    /** CANCELLATION/RELEASE=取消/退款：头单对称释放 */
    private async onRelease(ctx: RequestContext, movements: any[]): Promise<void> {
        const lineIds = new Set<string>();
        movements.forEach(m => {
            const id = String((m.orderLine as any)?.id ?? '');
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
            } catch (e: any) {
                Logger.warn(`取消释放预留失败(orderLine=${lineId}): ${e.message}`, loggerCtx);
            }
        }
    }
}