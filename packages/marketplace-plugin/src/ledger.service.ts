import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';

import { MarketplaceInventoryLedger } from './entities/marketplace-inventory-ledger.entity';

export interface LedgerRecordInput {
    variantId: ID;
    merchantChannelId: string;
    saleSource: string;
    stockBefore: number;
    stockAfter: number;
    stockDelta: number;
    actionType: string;
    orderId?: string | null;
    validFrom?: Date;
}

export interface LedgerQueryOptions {
    saleSource?: string;
    actionType?: string;
    from?: Date;
    to?: Date;
    orderId?: string;
}

/**
 * @description
 * 供销存中间表服务：负责写入与查询 `MarketplaceInventoryLedger` 记录。
 * 供 Task10 对账使用，可按商家、销售来源、时间范围等维度聚合查询。
 */
@Injectable()
export class LedgerService {
    constructor(private connection: TransactionalConnection) {}

    /** 写入一条 ledger 记录 */
    async recordChange(ctx: RequestContext, input: LedgerRecordInput): Promise<MarketplaceInventoryLedger> {
        const repo = this.connection.getRepository(ctx, MarketplaceInventoryLedger);
        const ledger = new MarketplaceInventoryLedger({
            variantId: input.variantId,
            merchantChannelId: input.merchantChannelId,
            saleSource: input.saleSource,
            stockBefore: input.stockBefore,
            stockAfter: input.stockAfter,
            stockDelta: input.stockDelta,
            actionType: input.actionType,
            orderId: input.orderId ?? null,
            validFrom: input.validFrom ?? new Date(),
            validTo: null,
        });
        return repo.save(ledger);
    }

    /** 按 merchantChannelId 聚合查询 */
    async queryByMerchant(
        ctx: RequestContext,
        merchantChannelId: string,
        options: LedgerQueryOptions = {},
    ): Promise<MarketplaceInventoryLedger[]> {
        const qb = this.connection
            .getRepository(ctx, MarketplaceInventoryLedger)
            .createQueryBuilder('ledger')
            .where('ledger.merchantChannelId = :merchantChannelId', { merchantChannelId });
        this.applyCommonFilters(qb, options);
        qb.orderBy('ledger.validFrom', 'DESC');
        return qb.getMany();
    }

    /** 按销售来源查询 */
    async queryBySaleSource(
        ctx: RequestContext,
        saleSource: string,
        options: LedgerQueryOptions = {},
    ): Promise<MarketplaceInventoryLedger[]> {
        const qb = this.connection
            .getRepository(ctx, MarketplaceInventoryLedger)
            .createQueryBuilder('ledger')
            .where('ledger.saleSource = :saleSource', { saleSource });
        this.applyCommonFilters(qb, options);
        qb.orderBy('ledger.validFrom', 'DESC');
        return qb.getMany();
    }

    /** 按时间范围查询（对账用） */
    async queryByDateRange(
        ctx: RequestContext,
        from: Date,
        to: Date,
        options: LedgerQueryOptions = {},
    ): Promise<MarketplaceInventoryLedger[]> {
        const qb = this.connection
            .getRepository(ctx, MarketplaceInventoryLedger)
            .createQueryBuilder('ledger')
            .where('ledger.validFrom >= :from AND ledger.validFrom <= :to', { from, to });
        this.applyCommonFilters(qb, options);
        qb.orderBy('ledger.validFrom', 'ASC');
        return qb.getMany();
    }

    private applyCommonFilters(
        qb: import('typeorm').SelectQueryBuilder<MarketplaceInventoryLedger>,
        options: LedgerQueryOptions,
    ): void {
        if (options.saleSource) {
            qb.andWhere('ledger.saleSource = :saleSource', { saleSource: options.saleSource });
        }
        if (options.actionType) {
            qb.andWhere('ledger.actionType = :actionType', { actionType: options.actionType });
        }
        if (options.orderId) {
            qb.andWhere('ledger.orderId = :orderId', { orderId: options.orderId });
        }
    }
}