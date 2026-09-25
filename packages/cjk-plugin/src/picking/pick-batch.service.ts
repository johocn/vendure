import { Injectable } from '@nestjs/common';
import {
    Fulfillment,
    FulfillmentService,
    ID,
    Order,
    OrderLine,
    OrderService,
    RequestContext,
    StockLocationService,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { In } from 'typeorm';

import { PickBatch, PickBatchState } from './pick-batch.entity';
import { PickBatchOrder } from './pick-batch-order.entity';
import {
    canTransition,
    formatBatchCode,
    nextSequence,
    pickRecommendation,
    sortPickingRows,
    type PickingRowInput,
    type WarehouseCandidate,
} from './pick-batch-math';
import { StorageBin } from '../storage/storage-bin.entity';
import { StorageZone } from '../storage/storage-zone.entity';
import { VariantStorageBin } from '../storage/variant-storage-bin.entity';

export interface PickBatchListOptions {
    page?: number;
    pageSize?: number;
    state?: PickBatchState | null;
    stockLocationId?: number | null;
}

/** 候选订单 / 批次成员共用的订单快照（前端直接消费，字段名与 apis/picking.ts 对齐） */
export interface PickOrderSnapshot {
    id: string;
    code: string;
    state: string;
    customerName: string | null;
    phoneNumber: string | null;
    province: string | null;
    city: string | null;
    streetLine1: string | null;
    streetLine2: string | null;
    postalCode: string | null;
    address: string;
    itemCount: number;
    recommendedStockLocationId: string | null;
    distanceKm: number | null;
    inBatchId: string | null;
    inBatchCode: string | null;
}

@Injectable()
export class PickBatchService {
    constructor(
        private connection: TransactionalConnection,
        private stockLocationService: StockLocationService,
        private orderService: OrderService,
        private fulfillmentService: FulfillmentService,
    ) {}

    /** 该批次的渠道归属，所有读写都必须带 tenantChannelId 过滤 */
    private tenantOf(ctx: RequestContext): string {
        return String(ctx.channelId);
    }

    async findAll(ctx: RequestContext, options: PickBatchListOptions) {
        const page = Math.max(1, options.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
        const repo = this.connection.getRepository(ctx, PickBatch);

        const qb = repo
            .createQueryBuilder('b')
            .where('b.tenantChannelId = :t', { t: this.tenantOf(ctx) })
            .orderBy('b.id', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize);

        if (options.state) qb.andWhere('b.state = :s', { s: options.state });
        if (options.stockLocationId) {
            qb.andWhere('b.stockLocationId = :w', { w: options.stockLocationId });
        }

        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findOne(ctx: RequestContext, id: ID): Promise<PickBatch | null> {
        return this.connection.getRepository(ctx, PickBatch).findOne({
            where: { id: id as number, tenantChannelId: this.tenantOf(ctx) },
        });
    }

    async members(ctx: RequestContext, batchId: ID): Promise<PickBatchOrder[]> {
        return this.connection.getRepository(ctx, PickBatchOrder).find({
            where: { batchId: batchId as number },
            order: { id: 'ASC' },
        });
    }

    /**
     * 同一订单不得同时存在于两个非终态批次中。
     * 命中时返回冲突批次号，供上层拼装明确原因。
     */
    async findConflicts(
        ctx: RequestContext,
        orderIds: number[],
        excludeBatchId?: number,
    ): Promise<Map<number, { batchId: number; code: string }>> {
        if (orderIds.length === 0) return new Map();
        const qb = this.connection
            .getRepository(ctx, PickBatchOrder)
            .createQueryBuilder('o')
            .innerJoin(PickBatch, 'b', 'b.id = o.batchId')
            .where('o.orderId IN (:...ids)', { ids: orderIds })
            .andWhere('b.tenantChannelId = :t', { t: this.tenantOf(ctx) })
            .andWhere('b.state NOT IN (:...done)', { done: ['SHIPPED', 'CANCELLED'] });
        if (excludeBatchId) {
            qb.andWhere('b.id != :ex', { ex: excludeBatchId });
        }
        const rows = await qb
            // 必须用 addSelect(列, 别名) 两参数形式：数组 + `AS` 写法在 join 查询下别名不生效，
            // getRawMany 取到的 r.orderId 恒为 undefined → 冲突提示变成「订单 #NaN 已在批次 X 中」（实测）。
            .select('o.orderId', 'orderId')
            .addSelect('b.id', 'batchId')
            .addSelect('b.code', 'code')
            .getRawMany<{ orderId: number; batchId: number; code: string }>();

        const map = new Map<number, { batchId: number; code: string }>();
        for (const r of rows) {
            map.set(Number(r.orderId), { batchId: Number(r.batchId), code: r.code });
        }
        return map;
    }

    /** 生成当日下一个批次号 */
    async nextCode(ctx: RequestContext, now = new Date()): Promise<string> {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const prefix = `PB${y}${m}${d}-`;
        const count = await this.connection
            .getRepository(ctx, PickBatch)
            .createQueryBuilder('b')
            .where('b.code LIKE :p', { p: `${prefix}%` })
            .getCount();
        return formatBatchCode(now, nextSequence(count));
    }

    async create(
        ctx: RequestContext,
        input: { stockLocationId: number; orderIds: number[]; note?: string | null },
        createdBy: string | null,
    ): Promise<PickBatch> {
        if (input.orderIds.length === 0) {
            throw new UserInputError('请至少选择一张订单');
        }
        const conflicts = await this.findConflicts(ctx, input.orderIds);
        if (conflicts.size > 0) {
            const [orderId, hit] = [...conflicts.entries()][0];
            throw new UserInputError(`订单 #${orderId} 已在批次 ${hit.code} 中，请先移出`);
        }

        const repo = this.connection.getRepository(ctx, PickBatch);
        const batch = await repo.save(
            repo.create({
                code: await this.nextCode(ctx),
                tenantChannelId: this.tenantOf(ctx),
                stockLocationId: input.stockLocationId,
                state: 'PENDING' as PickBatchState,
                note: input.note ?? null,
                createdBy,
            }),
        );

        const mRepo = this.connection.getRepository(ctx, PickBatchOrder);
        await mRepo.save(
            input.orderIds.map((orderId) =>
                mRepo.create({ batchId: batch.id as number, orderId, addedAt: new Date() }),
            ),
        );
        return batch;
    }

    async addOrders(ctx: RequestContext, batchId: ID, orderIds: number[]): Promise<PickBatch> {
        const batch = await this.requireBatch(ctx, batchId);
        this.assertState(batch, ['PENDING', 'PICKED'], '加单');
        const conflicts = await this.findConflicts(ctx, orderIds, batchId as number);
        if (conflicts.size > 0) {
            const [orderId, hit] = [...conflicts.entries()][0];
            throw new UserInputError(`订单 #${orderId} 已在批次 ${hit.code} 中，请先移出`);
        }
        const mRepo = this.connection.getRepository(ctx, PickBatchOrder);
        await mRepo.save(
            orderIds.map((orderId) =>
                mRepo.create({ batchId: batchId as number, orderId, addedAt: new Date() }),
            ),
        );
        return batch;
    }

    async removeOrders(ctx: RequestContext, batchId: ID, orderIds: number[]): Promise<PickBatch> {
        const batch = await this.requireBatch(ctx, batchId);
        this.assertState(batch, ['PENDING', 'PICKED'], '移出订单');
        await this.connection
            .getRepository(ctx, PickBatchOrder)
            .createQueryBuilder()
            .delete()
            .where('batchId = :b AND orderId IN (:...ids)', { b: batchId, ids: orderIds })
            .execute();
        return batch;
    }

    async advance(ctx: RequestContext, batchId: ID, to: PickBatchState): Promise<PickBatch> {
        const batch = await this.requireBatch(ctx, batchId);
        if (!canTransition(batch.state, to)) {
            throw new UserInputError(`批次 ${batch.code} 不能从 ${batch.state} 变为 ${to}`);
        }
        batch.state = to;
        const now = new Date();
        if (to === 'PICKED') batch.pickedAt = now;
        if (to === 'PRINTED') batch.printedAt = now;
        if (to === 'SHIPPED') batch.shippedAt = now;
        if (to === 'HANDOVER') batch.handoverAt = now;
        if (to === 'REVIEWED') batch.reviewedAt = now;
        if (to === 'EXCEPTION') batch.exceptionAt = now;
        return this.connection.getRepository(ctx, PickBatch).save(batch);
    }

    async cancel(ctx: RequestContext, batchId: ID): Promise<PickBatch> {
        return this.advance(ctx, batchId, 'CANCELLED');
    }

    /** 交接登记：写交接对象 + 推进到 HANDOVER（状态机仍由 advance 把关） */
    async handover(ctx: RequestContext, batchId: ID, handoverTo: string): Promise<PickBatch> {
        const batch = await this.requireBatch(ctx, batchId);
        if (!canTransition(batch.state, 'HANDOVER')) {
            throw new UserInputError(`批次 ${batch.code} 不能从 ${batch.state} 交接`);
        }
        batch.handoverTo = handoverTo;
        // 必须先落库再 advance：advance 内部会重新 requireBatch 取一个**新实体**，
        // 若只改内存对象再委托 advance，handoverTo 会被新实体覆盖丢失（实测 handoverTo 恒为 null）。
        await this.connection.getRepository(ctx, PickBatch).save(batch);
        return this.advance(ctx, batchId, 'HANDOVER');
    }

    /** 异常件登记：写原因 + 推进到 EXCEPTION */
    async registerException(ctx: RequestContext, batchId: ID, reason: string): Promise<PickBatch> {
        const batch = await this.requireBatch(ctx, batchId);
        if (!canTransition(batch.state, 'EXCEPTION')) {
            throw new UserInputError(`批次 ${batch.code} 当前状态 ${batch.state} 不能登记异常`);
        }
        batch.exceptionNote = reason;
        await this.connection.getRepository(ctx, PickBatch).save(batch);
        return this.advance(ctx, batchId, 'EXCEPTION');
    }

    /**
     * 拣货汇总：按 SKU 合并数量、收集涉及订单号，并按库位排序出拣货路径。
     * 三档共用：zone 档下 rowNo / levelNo 为 null，排序自动退化为按库区。
     * 用仓储 + JS 聚合实现（方言无关，sqlite / postgres 行为一致）。
     */
    async pickingList(ctx: RequestContext, batchId: ID): Promise<ReturnType<typeof sortPickingRows>> {
        const batch = await this.requireBatch(ctx, batchId);
        const members = await this.members(ctx, batchId);
        if (members.length === 0) return [];

        const orderIds = members.map((m) => m.orderId);
        const orders = await this.connection.getRepository(ctx, Order).find({
            where: { id: In(orderIds) },
            relations: { lines: { productVariant: true } },
        });

        // SKU 合并数量 + 涉及订单号
        const bySku = new Map<string, { sku: string; name: string; qty: number; codes: Set<string> }>();
        const variantIds = new Set<number>();
        for (const o of orders) {
            for (const line of o.lines ?? []) {
                const sku = line.productVariant?.sku ?? '';
                if (!sku) continue;
                variantIds.add(line.productVariant.id as number);
                const hit = bySku.get(sku) ?? {
                    sku,
                    // ProductVariant.name 列可为 null：SDL 里 name 是非空字段，
                    // 直接透传会让整条 pickBatchPickingList 查询报错返回 null（前端表现为拣货汇总空白）。
                    // 与前端 `r.name || r.sku` 一致，缺失时回退 SKU。
                    name: line.productVariant.name || line.productVariant.sku || '',
                    qty: 0,
                    codes: new Set<string>(),
                };
                hit.qty += line.quantity;
                hit.codes.add(o.code);
                bySku.set(sku, hit);
            }
        }
        if (bySku.size === 0) return [];

        // 库位绑定（该批次目标仓）
        const bindings = await this.connection.getRepository(ctx, VariantStorageBin).find({
            where: {
                tenantChannelId: this.tenantOf(ctx),
                stockLocationId: batch.stockLocationId,
                variantId: In([...variantIds]),
            },
        });
        const binIds = bindings.map((b) => b.binId).filter((x): x is number => x !== null);
        const zoneIds = bindings.map((b) => b.zoneId).filter((x): x is number => x !== null);
        const bins = binIds.length
            ? await this.connection.getRepository(ctx, StorageBin).find({ where: { id: In(binIds) } })
            : [];
        const zones = zoneIds.length
            ? await this.connection.getRepository(ctx, StorageZone).find({ where: { id: In(zoneIds) } })
            : [];
        const binById = new Map(bins.map((b) => [b.id as number, b]));
        const zoneById = new Map(zones.map((z) => [z.id as number, z]));
        const bindingByVariant = new Map(bindings.map((b) => [b.variantId, b]));

        const inputs: PickingRowInput[] = [];
        for (const hit of bySku.values()) {
            // 同一 SKU 可能对应多个 variant，取任一有绑定的推算库位
            const variant = [...variantIds].find(
                (vid) =>
                    bindingByVariant.has(vid) &&
                    orders.some((o) =>
                        (o.lines ?? []).some(
                            (l) => l.productVariant?.id === vid && l.productVariant?.sku === hit.sku,
                        ),
                    ),
            );
            const binding = variant !== undefined ? bindingByVariant.get(variant) : undefined;
            const bin = binding?.binId != null ? binById.get(binding.binId) : undefined;
            const zone = binding?.zoneId != null ? zoneById.get(binding.zoneId) : undefined;
            inputs.push({
                sku: hit.sku,
                name: hit.name,
                qty: hit.qty,
                orderCodes: [...hit.codes].sort(),
                zoneSortOrder: zone?.sortOrder ?? null,
                rowNo: bin?.rowNo ?? null,
                levelNo: bin?.levelNo ?? null,
                binCode: bin?.code ?? null,
                zoneCode: zone?.code ?? null,
                zoneName: zone?.name ?? null,
            });
        }
        return sortPickingRows(inputs);
    }

    /** 候选订单的就近选仓推荐 */
    recommend(order: Order, warehouses: WarehouseCandidate[]) {
        const shipping = order.shippingAddress;
        return pickRecommendation(
            {
                city: shipping?.city ?? null,
                lat: (shipping as any)?.latitude ?? null,
                lng: (shipping as any)?.longitude ?? null,
            },
            warehouses,
        );
    }

    /** 批次列表视图：补 SDL 要求的 memberCount / itemCount */
    private async warehouseCandidates(ctx: RequestContext): Promise<WarehouseCandidate[]> {
        const { items } = await this.stockLocationService.findAll(ctx, { take: 500 } as any);
        return items.map((l) => {
            const cf: any = (l.customFields as any) ?? {};
            return {
                id: Number(l.id),
                enabled: true,
                serviceCities: (cf.serviceCities ?? null) as string[] | null,
                lat: typeof cf.lat === 'number' ? cf.lat : null,
                lng: typeof cf.lng === 'number' ? cf.lng : null,
            };
        });
    }

    /** 各批次成员数与件数 */
    async counts(
        ctx: RequestContext,
        batchIds: number[],
    ): Promise<Map<number, { memberCount: number; itemCount: number }>> {
        const out = new Map<number, { memberCount: number; itemCount: number }>();
        if (batchIds.length === 0) return out;

        const memberRows = await this.connection
            .getRepository(ctx, PickBatchOrder)
            .createQueryBuilder('o')
            .select('o.batchId', 'batchId')
            .addSelect('COUNT(1)', 'n')
            .where('o.batchId IN (:...ids)', { ids: batchIds })
            .groupBy('o.batchId')
            .getRawMany<{ batchId: number; n: string }>();

        const allMembers = await this.connection.getRepository(ctx, PickBatchOrder).find({
            where: { batchId: In(batchIds) },
        });
        const orderIds = allMembers.map((m) => m.orderId);
        const lineRows = orderIds.length
            ? await this.connection
                  .getRepository(ctx, OrderLine)
                  .createQueryBuilder('l')
                  .select('l.orderId', 'orderId')
                  .addSelect('COALESCE(SUM(l.quantity), 0)', 'n')
                  .where('l.orderId IN (:...ids)', { ids: orderIds })
                  .groupBy('l.orderId')
                  .getRawMany<{ orderId: number; n: string }>()
            : [];
        const qtyByOrder = new Map(lineRows.map((r) => [Number(r.orderId), Number(r.n)]));

        for (const id of batchIds) {
            out.set(id, { memberCount: 0, itemCount: 0 });
        }
        for (const r of memberRows) {
            const hit = out.get(Number(r.batchId));
            if (hit) hit.memberCount = Number(r.n);
        }
        for (const m of allMembers) {
            const hit = out.get(m.batchId);
            if (hit) hit.itemCount += qtyByOrder.get(m.orderId) ?? 0;
        }
        return out;
    }

    /** 列表视图：批次字段 + memberCount / itemCount */
    async findAllView(ctx: RequestContext, options: PickBatchListOptions) {
        const { items, totalItems } = await this.findAll(ctx, options);
        const counts = await this.counts(
            ctx,
            items.map((b) => Number(b.id)),
        );
        return {
            totalItems,
            items: items.map((b) => this.toView(b, counts.get(Number(b.id)))),
        };
    }

    /** 详情视图：批次字段 + members（订单快照） */
    async detail(ctx: RequestContext, id: ID) {
        const batch = await this.findOne(ctx, id);
        if (!batch) return null;
        const counts = await this.counts(ctx, [Number(batch.id)]);
        return {
            ...this.toView(batch, counts.get(Number(batch.id))),
            members: await this.membersSnapshot(ctx, batch.id),
        };
    }

    private toView(
        b: PickBatch,
        counts?: { memberCount: number; itemCount: number },
    ): Record<string, unknown> {
        return {
            id: String(b.id),
            code: b.code,
            stockLocationId: b.stockLocationId,
            state: b.state,
            note: b.note ?? null,
            createdBy: b.createdBy ?? null,
            memberCount: counts?.memberCount ?? 0,
            itemCount: counts?.itemCount ?? 0,
            pickedAt: b.pickedAt ?? null,
            printedAt: b.printedAt ?? null,
            shippedAt: b.shippedAt ?? null,
            handoverAt: b.handoverAt ?? null,
            handoverTo: b.handoverTo ?? null,
            reviewedAt: b.reviewedAt ?? null,
            exceptionAt: b.exceptionAt ?? null,
            exceptionNote: b.exceptionNote ?? null,
            createdAt: b.createdAt ?? null,
        };
    }

    /** 批次成员订单快照（含推荐仓与距离） */
    async membersSnapshot(ctx: RequestContext, batchId: ID): Promise<PickOrderSnapshot[]> {
        const members = await this.members(ctx, batchId);
        if (members.length === 0) return [];
        const orders = await this.connection.getRepository(ctx, Order).find({
            where: { id: In(members.map((m) => m.orderId)) },
            relations: { lines: true, customer: true },
        });
        const warehouses = await this.warehouseCandidates(ctx);
        const byId = new Map(orders.map((o) => [Number(o.id), o]));
        return members
            .map((m) => byId.get(m.orderId))
            .filter((o): o is Order => !!o)
            .map((o) => this.snapshotOrder(o, warehouses));
    }

    /**
     * 待发货候选订单：默认 PaymentAuthorized / WaitingForShipping，
     * 带就近仓推荐与「已在某批次」标记（设计 §6.2）。
     */
    async candidates(ctx: RequestContext, options: PickBatchListOptions) {
        const page = Math.max(1, options.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
        const repo = this.connection.getRepository(ctx, Order);
        // 候选订单必须属于**当前渠道**：Order 是 ChannelAware（多对多 order_channels_channel），
        // 裸仓储查询不做渠道收口，会把其它渠道的订单串进本店配货台
        // （实测 t2 渠道里出现了渠道 1 / official-01 的订单）。与 findAll 按 tenantChannelId 收口保持一致。
        const base = repo
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'pickChannel', 'pickChannel.id = :cid', { cid: ctx.channelId })
            .where('o.state IN (:...states)', { states: ['PaymentAuthorized', 'WaitingForShipping'] });
        const totalItems = await base.clone().getCount();
        if (totalItems === 0) return { items: [], totalItems };

        // 先分页取 id 再按 id 取实体：避免多对多 join 与 skip/take 同用导致行重复
        const idRows = await base
            .clone()
            .select('o.id', 'id')
            .orderBy('o.id', 'DESC')
            .offset((page - 1) * pageSize)
            .limit(pageSize)
            .getRawMany<{ id: number }>();
        const idList = idRows.map((r) => Number(r.id));
        if (idList.length === 0) return { items: [], totalItems };

        const orders = await repo.find({
            where: { id: In(idList) },
            relations: { lines: true, customer: true },
            order: { id: 'DESC' },
        });

        const warehouses = await this.warehouseCandidates(ctx);
        const conflicts = await this.findConflicts(ctx, idList);
        return {
            totalItems,
            items: orders.map((o) => this.snapshotOrder(o, warehouses, conflicts.get(Number(o.id)))),
        };
    }

    private snapshotOrder(
        order: Order,
        warehouses: WarehouseCandidate[],
        conflict?: { batchId: number; code: string },
    ): PickOrderSnapshot {
        const a: any = order.shippingAddress ?? {};
        const rec = this.recommend(order, warehouses);
        const name = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ');
        const address = [a.province, a.city, a.streetLine1, a.streetLine2]
            .filter((x: any) => !!x)
            .join('');
        return {
            id: String(order.id),
            code: order.code,
            state: String(order.state),
            customerName: a.fullName || name || null,
            phoneNumber: a.phoneNumber ?? order.customer?.phoneNumber ?? null,
            province: a.province ?? null,
            city: a.city ?? null,
            streetLine1: a.streetLine1 ?? null,
            streetLine2: a.streetLine2 ?? null,
            postalCode: a.postalCode ?? null,
            address,
            itemCount: (order.lines ?? []).reduce((n, l) => n + l.quantity, 0),
            recommendedStockLocationId:
                rec.recommendedStockLocationId === null ? null : String(rec.recommendedStockLocationId),
            distanceKm: rec.distanceKm,
            inBatchId: conflict ? String(conflict.batchId) : null,
            inBatchCode: conflict?.code ?? null,
        };
    }

    /** 订单行中尚未被任何履约覆盖的部分 */
    private pendingFulfillmentLines(order: Order): { orderLineId: ID; quantity: number }[] {
        const covered = new Map<string, number>();
        for (const f of (order as any).fulfillments ?? []) {
            for (const fl of (f as any).lines ?? []) {
                const key = String(fl.orderLineId);
                covered.set(key, (covered.get(key) ?? 0) + fl.quantity);
            }
        }
        return (order.lines ?? [])
            .map((l) => ({ orderLineId: l.id, quantity: l.quantity - (covered.get(String(l.id)) ?? 0) }))
            .filter((l) => l.quantity > 0);
    }

    /**
     * 批量发货：逐单生成独立 fulfillment（不合并包裹、不合并运单）。
     * 全部成功才推进到 SHIPPED；有失败则保持原状态并返回失败清单（设计 §5）。
     */
    async ship(
        ctx: RequestContext,
        batchId: ID,
        input: { method: string; trackingCode?: string | null },
    ): Promise<{
        succeeded: Array<{ orderId: string; code: string; fulfillmentId: string | null }>;
        failed: Array<{ orderId: string; code: string; reason: string }>;
    }> {
        const batch = await this.requireBatch(ctx, batchId);
        this.assertState(batch, ['PENDING', 'PICKED', 'PRINTED'], '发货');
        const members = await this.members(ctx, batchId);

        const args = [{ name: 'method', value: input.method || 'standard' }];
        if (input.trackingCode) args.push({ name: 'trackingCode', value: input.trackingCode });
        const handler = { code: 'manual-fulfillment', arguments: args };

        const succeeded: Array<{ orderId: string; code: string; fulfillmentId: string | null }> = [];
        const failed: Array<{ orderId: string; code: string; reason: string }> = [];

        for (const m of members) {
            const order = (await this.orderService.findOne(ctx, m.orderId, [
                'lines',
                'fulfillments',
                'fulfillments.lines',
            ])) as Order | undefined;
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
                const created = await this.fulfillmentService.create(
                    ctx,
                    [order],
                    remaining,
                    handler as any,
                );
                if (!(created instanceof Fulfillment)) {
                    throw new Error((created as any)?.message ?? '生成发货单失败');
                }
                succeeded.push({
                    orderId: String(order.id),
                    code: order.code,
                    fulfillmentId: String(created.id),
                });
            } catch (e: any) {
                failed.push({ orderId: String(order.id), code: order.code, reason: e?.message ?? '发货失败' });
            }
        }

        // 全部成功才置 SHIPPED：状态机不允许跳级，按链条逐级推进。
        // 只跑当前状态**之后**的级：印刷态批次（PRINTED）若从 PICKED 起步会被状态机拒绝
        // （PRINTED→PICKED 非法），导致「已打单」批次整批发货恒失败。
        if (failed.length === 0 && succeeded.length > 0) {
            const chain: PickBatchState[] = ['PENDING', 'PICKED', 'PRINTED', 'SHIPPED'];
            const from = chain.indexOf(batch.state as PickBatchState);
            for (const step of chain.slice(from + 1)) {
                await this.advance(ctx, batchId, step);
            }
        }
        return { succeeded, failed };
    }

    private async requireBatch(ctx: RequestContext, id: ID): Promise<PickBatch> {
        const batch = await this.findOne(ctx, id);
        if (!batch) throw new UserInputError(`批次 ${id} 不存在`);
        return batch;
    }

    private assertState(batch: PickBatch, allowed: PickBatchState[], action: string) {
        if (!allowed.includes(batch.state)) {
            throw new UserInputError(`批次 ${batch.code} 当前为 ${batch.state}，不可${action}`);
        }
    }
}