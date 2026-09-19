import { Injectable } from '@nestjs/common';
import { ID, RequestContext, StockLevelService, TransactionalConnection } from '@vendure/core';
import { InventoryAdapter, InventoryAdapterMode, StockSnapshot } from './inventory-adapter';
import { StockDocItemEntity } from './stock-doc-item.entity';

/**
 * simple 模式适配器：直接读取本地 stockLevel（物理/虚拟仓 onHand），
 * costPrice 取近期的单据成本价（StockDocItemEntity 最新一条非空 costPrice）。
 */
@Injectable()
export class SimpleInventoryAdapter implements InventoryAdapter {
    mode: InventoryAdapterMode = 'simple';

    constructor(
        private stockLevelService: StockLevelService,
        private conn: TransactionalConnection,
    ) {}

    async fetchStock(ctx: RequestContext, variantId: number, locationId?: number): Promise<StockSnapshot[]> {
        if (locationId != null) {
            const level = await this.stockLevelService.getStockLevel(ctx, variantId as ID, locationId as ID);
            return [{ variantId, locationId, onHand: level.stockOnHand }];
        }
        const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId as ID);
        return levels.map(l => ({
            variantId,
            locationId: Number(l.stockLocationId),
            onHand: l.stockOnHand,
        }));
    }

    async fetchCost(ctx: RequestContext, variantId: number, _locationId?: number): Promise<number | null> {
        const row = await this.conn
            .getRepository(ctx, StockDocItemEntity)
            .createQueryBuilder('item')
            .where('item.variantId = :variantId', { variantId })
            .andWhere('item.costPrice IS NOT NULL')
            .orderBy('item.id', 'DESC')
            .getOne();
        return row?.costPrice ?? null;
    }
}