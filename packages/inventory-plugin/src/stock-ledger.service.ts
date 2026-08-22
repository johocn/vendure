import { Injectable } from '@nestjs/common';
import { ID, ListQueryBuilder, ListQueryOptions, Logger, RequestContext, TransactionalConnection } from '@vendure/core';

import { OrderStockLedger } from './entities/order-stock-ledger.entity';

const loggerCtx = 'StockLedgerService';

export type LedgerBizType =
    | 'order'
    | 'afterSales'
    | 'stockIn'
    | 'stockOut'
    | 'stockMove'
    | 'stocktake'
    | 'purchase'
    | 'manual';

export interface StockLedgerInput {
    productVariantId: ID;
    stockLocationId: ID;
    bizType: LedgerBizType;
    bizCode?: string;
    orderLineId?: ID;
    /** 默认按 delta 符号推导：>=0 => in，<0 => out */
    direction?: 'in' | 'out';
    quantity: number;
    beforeOnHand?: number;
    afterOnHand?: number;
    otherLocationId?: ID;
    reason?: string;
}

@Injectable()
export class StockLedgerService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    /**
     * 写一条账本流水（沿用与业务一致的 ctx，若处于事务中则写入同一事务）。
     */
    async record(ctx: RequestContext, input: StockLedgerInput): Promise<OrderStockLedger> {
        const direction = input.direction ?? (input.quantity >= 0 ? 'in' : 'out');
        const entry = new OrderStockLedger({
            code: this.generateCode('YSZ'),
            productVariantId: input.productVariantId as any,
            stockLocationId: input.stockLocationId as any,
            bizType: input.bizType,
            bizCode: input.bizCode ?? null,
            orderLineId: input.orderLineId != null ? Number(input.orderLineId) : null,
            direction,
            quantity: Math.abs(input.quantity),
            beforeOnHand: input.beforeOnHand ?? null,
            afterOnHand: input.afterOnHand ?? null,
            otherLocationId: input.otherLocationId != null ? Number(input.otherLocationId) : null,
            reason: input.reason ?? null,
        });
        entry.channels = [ctx.channel];
        const repo = this.connection.getRepository(ctx, OrderStockLedger);
        const saved = await repo.save(entry);
        Logger.debug(`Ledger ${saved.code}: ${saved.bizType}/${saved.direction}/${saved.quantity} @loc#${saved.stockLocationId}`, loggerCtx);
        return saved;
    }

    async list(
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
    ): Promise<{ items: OrderStockLedger[]; totalItems: number }> {
        const queryOptions: ListQueryOptions<OrderStockLedger> = {
            skip: ((options?.page ?? 1) - 1) * (options?.pageSize ?? 20),
            take: options?.pageSize ?? 20,
            sort: { createdAt: 'DESC' } as any,
        };
        const qb = this.listQueryBuilder
            .build(OrderStockLedger, queryOptions, {
                ctx,
                channelId: ctx.channelId,
                entityAlias: 'order_stock_ledger',
            });

        if (options?.productVariantId) qb.andWhere('order_stock_ledger.productVariantId = :vid', { vid: options.productVariantId });
        if (options?.locationId) qb.andWhere('order_stock_ledger.stockLocationId = :lid', { lid: options.locationId });
        if (options?.bizType) qb.andWhere('order_stock_ledger.bizType = :bt', { bt: options.bizType });
        if (options?.bizCode) qb.andWhere('order_stock_ledger.bizCode = :bc', { bc: options.bizCode });
        if (options?.orderLineId) qb.andWhere('order_stock_ledger.orderLineId = :ol', { ol: options.orderLineId });

        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    private generateCode(prefix: string): string {
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
}