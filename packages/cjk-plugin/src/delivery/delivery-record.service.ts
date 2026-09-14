import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { Sale } from '@vendure/core';
import { In } from 'typeorm';
import { DeliveryRecord } from './delivery-record.entity';
import { DeliveryMode, DeliveryState, validateDeliveryTransition } from './delivery-state';

const loggerCtx = 'DeliveryRecordService';

@Injectable()
export class DeliveryRecordService {
    constructor(private connection: TransactionalConnection) {}

    private physicalEnabled(ctx: RequestContext): boolean {
        return Boolean((ctx.channel.customFields as any)?.physicalStockEnabled);
    }

    /** 依 SALE 事件生成顾客配送记录：按 orderId+sourceLocationId 分组，幂等防重 */
    async createFromSales(ctx: RequestContext, sales: Sale[]): Promise<DeliveryRecord[]> {
        if (!this.physicalEnabled(ctx) || !sales?.length) {
            return [];
        }
        const repo = this.connection.getRepository(ctx, DeliveryRecord);
        // orderLine -> orderId
        const lineIds = [...new Set(sales.map(s => String((s.orderLine as any)?.id ?? s.orderLineId)))].filter(Boolean);
        const orderLines = lineIds.length
            ? await this.connection.getRepository(ctx, 'OrderLine' as any).find({ where: { id: In(lineIds) } })
            : [];
        const lineOrderMap = new Map(orderLines.map((ol: any) => [String(ol.id), String(ol.orderId)]));

        const groups = new Map<string, { orderId: string; sourceLocationId: ID | null; quantity: number; lineIds: string[] }>();
        for (const sale of sales) {
            const lineId = String((sale.orderLine as any)?.id ?? sale.orderLineId);
            const orderId = lineOrderMap.get(lineId) ?? String((sale as any).orderId ?? '');
            if (!orderId) {
                continue;
            }
            const key = `${orderId}|${sale.stockLocationId}`;
            const g = groups.get(key) ?? {
                orderId, sourceLocationId: sale.stockLocationId, quantity: 0, lineIds: [],
            };
            g.quantity += sale.quantity;
            g.lineIds.push(lineId);
            groups.set(key, g);
        }

        const created: DeliveryRecord[] = [];
        for (const g of groups.values()) {
            const dup = await repo.find({
                where: {
                    orderId: g.orderId as any,
                    sourceLocationId: g.sourceLocationId as any,
                },
            });
            const open = dup.filter(d => d.status !== 'Delivered' && d.status !== 'Completed' && d.status !== 'Returned');
            if (open.length) {
                continue; // 防重复
            }
            const record = await repo.save(
                new DeliveryRecord({
                    orderId: g.orderId as any,
                    sourceLocationId: g.sourceLocationId as any,
                    mode: 'self',
                    status: 'Draft',
                }),
            );
            created.push(record);
            Logger.info(`配送记录已生成: order=${g.orderId} loc=${g.sourceLocationId}`, loggerCtx);
        }
        return created;
    }

    /** 状态流转（校验合法迁移 + 记录时间戳） */
    async transition(ctx: RequestContext, id: ID, to: DeliveryState): Promise<DeliveryRecord> {
        const repo = this.connection.getRepository(ctx, DeliveryRecord);
        const record = await repo.findOne({ where: { id: id as any } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        if (!validateDeliveryTransition(record.mode, record.status, to)) {
            throw new Error(`非法状态迁移: ${record.mode} ${record.status} -> ${to}`);
        }
        record.status = to;
        const now = new Date();
        if (to === 'Delivered' || to === 'Completed') {
            record.deliveredAt = now;
        } else if (to === 'Returned') {
            record.returnedAt = now;
        } else if (to === 'Exception') {
            record.exceptionAt = now;
        } else if (to === 'Shipped' || to === 'Assigned' || to === 'InProgress') {
            record.sentAt = now;
        }
        return repo.save(record);
    }

    /** 快递录单 */
    async setExpress(
        ctx: RequestContext,
        id: ID,
        expressCompany: string,
        trackingNo: string,
    ): Promise<DeliveryRecord> {
        const repo = this.connection.getRepository(ctx, DeliveryRecord);
        const record = await repo.findOne({ where: { id: id as any } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        record.mode = 'express';
        record.expressCompany = expressCompany;
        record.trackingNo = trackingNo;
        if (record.status === 'Draft') {
            record.status = 'Shipped';
            record.sentAt = new Date();
        }
        return repo.save(record);
    }

    /** 自营指派 */
    async assignStaff(ctx: RequestContext, id: ID, staffId: string, staffName?: string): Promise<DeliveryRecord> {
        const repo = this.connection.getRepository(ctx, DeliveryRecord);
        const record = await repo.findOne({ where: { id: id as any } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        record.staffId = staffId;
        record.staffName = staffName ?? null;
        if (record.status === 'Draft') {
            record.status = 'Assigned';
            record.sentAt = new Date();
        }
        return repo.save(record);
    }

    /** 自提点模式重设（pickup 订单发货时调用） */
    async markAsPickup(
        ctx: RequestContext,
        id: ID,
        pickupLocationId: ID,
        mode: DeliveryMode = 'pickup',
    ): Promise<DeliveryRecord> {
        const repo = this.connection.getRepository(ctx, DeliveryRecord);
        const record = await repo.findOne({ where: { id: id as any } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        record.mode = mode;
        record.pickupLocationId = pickupLocationId as any;
        if (record.status === 'Draft') {
            record.status = mode === 'transfer' ? 'TransferPending' : 'PickupPending';
        }
        return repo.save(record);
    }

    /** transfer 到达：入自提点仓（toLocationId），触发 A 镜像 */
    async markTransferArrived(
        ctx: RequestContext,
        id: ID,
        adjustStockPublic: (ctx: RequestContext, variantId: ID, locationId: ID, delta: number, reason: string, meta?: any) => Promise<void>,
    ): Promise<DeliveryRecord> {
        const repo = this.connection.getRepository(ctx, DeliveryRecord);
        const record = await repo.findOne({ where: { id: id as any } });
        if (!record) {
            throw new Error(`配送记录不存在: ${id}`);
        }
        if (record.mode !== 'transfer' || !record.toLocationId || !record.itemsJson) {
            throw new Error(`非 transfer 记录或无明细，无法收货`);
        }
        if (record.status !== 'InTransit') {
            throw new Error(`状态须为 InTransit 才能收货: ${record.status}`);
        }
        const items: Array<{ variantId: string; quantity: number }> = JSON.parse(record.itemsJson);
        for (const item of items) {
            await adjustStockPublic(ctx, item.variantId as any, record.toLocationId, item.quantity, `自提点收货(record=${record.id})`, {
                bizType: 'stockIn',
                bizCode: `transfer-${record.id}`,
            });
        }
        record.status = 'Arrived';
        record.deliveredAt = new Date();
        return repo.save(record);
    }
}
