import { Injectable } from '@nestjs/common';
import { ID, Order, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
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

@Injectable()
export class PickBatchService {
    constructor(private connection: TransactionalConnection) {}

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
    ): Promise<Map<number, string>> {
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
            .select(['o.orderId AS orderId', 'b.code AS code'])
            .getRawMany<{ orderId: number; code: string }>();

        const map = new Map<number, string>();
        for (const r of rows) map.set(Number(r.orderId), r.code);
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
            const [orderId, code] = [...conflicts.entries()][0];
            throw new UserInputError(`订单 #${orderId} 已在批次 ${code} 中，请先移出`);
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
            const [orderId, code] = [...conflicts.entries()][0];
            throw new UserInputError(`订单 #${orderId} 已在批次 ${code} 中，请先移出`);
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
        return this.connection.getRepository(ctx, PickBatch).save(batch);
    }

    async cancel(ctx: RequestContext, batchId: ID): Promise<PickBatch> {
        return this.advance(ctx, batchId, 'CANCELLED');
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
                    name: line.productVariant.name,
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