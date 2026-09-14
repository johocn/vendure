import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';
import { ReconciliationBatch, ReconciliationOrderLine } from './reconciliation.entity';
import { diffOrder, DiffType } from './diff-rules';

const loggerCtx = 'ReconciliationService';

@Injectable()
export class ReconciliationService {
    constructor(private connection: TransactionalConnection) {}

    /** 幂等跑批：同日已有 done 批次则返回 null */
    async runBatch(
        ctx: RequestContext,
        date: string,
        trigger: 'manual' | 'cron',
    ): Promise<ReconciliationBatch | null> {
        const batchRepo = this.connection.getRepository(ctx, ReconciliationBatch);
        const existing = await batchRepo.findOne({
            where: { tenantChannelId: ctx.channelId as any, date },
        });
        if (existing?.status === 'done') {
            return null;
        }
        const batch = existing ?? (await batchRepo.save(new ReconciliationBatch({
            tenantChannelId: ctx.channelId as any,
            date,
            status: 'running',
            trigger,
            startedAt: new Date(),
        })));

        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);
        // 当前租户渠道下订单（Order 通过 channels 多对多归属渠道）；取前 500 单
        const orders = await orderRepo.find({
            where: { channels: { id: ctx.channelId as any } } as any,
            relations: { lines: true } as any,
            take: 500,
        });

        const lineRepo = this.connection.getRepository(ctx, ReconciliationOrderLine);
        let d1 = 0, d2 = 0, d3 = 0, d4 = 0;
        for (const order of orders) {
            const data = await this.collectOrderData(ctx, order as any);
            const diffs = diffOrder({
                order: {
                    id: String(order.id),
                    totalWithTax: (order as any).totalWithTax ?? 0,
                    state: (order as any).state ?? '',
                    customFields: (order as any).customFields ?? {},
                },
                deliveryRecords: data.deliveryRecords,
                ledgerOuts: data.ledgerOuts,
                settlements: data.settlements,
                mirrorDiff: data.mirrorDiff,
                cancelled: (order as any).state === 'Cancelled',
            });
            if (diffs.length) {
                await lineRepo.save(new ReconciliationOrderLine({
                    batchId: batch.id,
                    orderId: order.id as any,
                    diffTypes: JSON.stringify(diffs),
                    status: 'pending',
                }));
                d1 += diffs.includes('D1') ? 1 : 0;
                d2 += diffs.includes('D2') ? 1 : 0;
                d3 += diffs.includes('D3') ? 1 : 0;
                d4 += diffs.includes('D4') ? 1 : 0;
            }
        }

        batch.status = 'done';
        batch.d1Count = d1;
        batch.d2Count = d2;
        batch.d3Count = d3;
        batch.d4Count = d4;
        batch.orderTotal = orders.length;
        batch.finishedAt = new Date();
        await batchRepo.save(batch);
        Logger.info(`对账批次完成: ${date} 订单=${orders.length} D1=${d1} D2=${d2} D3=${d3} D4=${d4}`, loggerCtx);
        return batch;
    }

    /** 采集一单四流数据（数据源：Order / OrderStockLedger / DeliveryRecord / MerchantSettlementLedger） */
    private async collectOrderData(ctx: RequestContext, order: any) {
        const lineIds: number[] = (order.lines ?? []).map((l: any) => l.id);
        const outs: any[] = [];
        const mirrors: any[] = [];
        if (lineIds.length) {
            const ledgerRepo = this.connection.getRepository(ctx, 'OrderStockLedger' as any);
            const ledgers = await ledgerRepo.find({ where: { orderLineId: In(lineIds) } });
            outs.push(...ledgers.filter((l: any) => l.bizType === 'order' && l.direction === 'out'));
            mirrors.push(...ledgers.filter((l: any) => l.bizType === 'mirror'));
        }
        const deliveryRepo = this.connection.getRepository(ctx, 'DeliveryRecord' as any);
        const records = await deliveryRepo.find({ where: { orderId: order.id as any } });
        const settleRepo = this.connection.getRepository(ctx, 'MerchantSettlementLedger' as any);
        const settlements = await settleRepo.find({ where: { orderId: order.id as any } });
        return {
            deliveryRecords: records.map((r: any) => ({ mode: r.mode, sourceLocationId: r.sourceLocationId, status: r.status })),
            ledgerOuts: outs.map((l: any) => ({ sourceLocationId: l.stockLocationId, quantity: l.quantity })),
            settlements: settlements.map((s: any) => ({ status: s.status, amount: s.amount })),
            mirrorDiff: mirrors.reduce((sum: number, m: any) => sum + (m.direction === 'in' ? m.quantity : -m.quantity), 0),
        };
    }

    /** 重跑单条：重新判定后置 closed */
    async rerunOrder(ctx: RequestContext, lineId: ID): Promise<ReconciliationOrderLine> {
        const lineRepo = this.connection.getRepository(ctx, ReconciliationOrderLine);
        const line = await lineRepo.findOne({ where: { id: lineId as any } });
        if (!line) {
            throw new Error(`对账行不存在: ${lineId}`);
        }
        const orderRepo = this.connection.getRepository(ctx, 'Order' as any);
        const order = await orderRepo.findOne({
            where: { id: line.orderId as any },
            relations: { lines: true } as any,
        });
        if (!order) {
            throw new Error(`订单不存在: ${line.orderId}`);
        }
        const data = await this.collectOrderData(ctx, order as any);
        const diffs = diffOrder({
            order: {
                id: String(order.id),
                totalWithTax: (order as any).totalWithTax ?? 0,
                state: (order as any).state ?? '',
                customFields: (order as any).customFields ?? {},
            },
            deliveryRecords: data.deliveryRecords,
            ledgerOuts: data.ledgerOuts,
            settlements: data.settlements,
            mirrorDiff: data.mirrorDiff,
            cancelled: (order as any).state === 'Cancelled',
        });
        line.diffTypes = JSON.stringify(diffs);
        line.status = diffs.length ? 'pending' : 'closed';
        if (!diffs.length) {
            line.fixedAt = new Date();
        }
        return lineRepo.save(line);
    }

    async listBatches(ctx: RequestContext): Promise<ReconciliationBatch[]> {
        return this.connection.getRepository(ctx, ReconciliationBatch).find({
            where: { tenantChannelId: ctx.channelId as any },
            order: { createdAt: 'DESC' } as any,
            take: 60,
        });
    }

    async listLines(ctx: RequestContext, batchId: ID): Promise<ReconciliationOrderLine[]> {
        return this.connection.getRepository(ctx, ReconciliationOrderLine).find({
            where: { batchId: batchId as any },
            order: { createdAt: 'ASC' } as any,
        });
    }
}
