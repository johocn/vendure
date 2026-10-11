import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { DiyMaterial } from './entities/diy-material.entity';

export interface StockItem {
    materialId: number;
    qty: number;
}

export interface StockShortage {
    materialId: number;
    code: string;
    required: number;
    available: number;
}

/**
 * 素材库存（偏差 3：DB 原子 UPDATE 替代 Redis 锁）：
 * `stock = stock - qty WHERE id = ? AND stock >= qty` 单语句原子，affected=0 即缺口。
 * deduct 全有或全无：任一缺口先回补已扣行，再返回缺口明细（不抛错，由调用方转 UserInputError）。
 * 库存归属：BOM.materialId 指向合并视图行——未复制的平台行扣平台库存，租户复制行扣租户库存（规格 §4.3）。
 * ctx 可传 undefined（事件订阅者等无 ctx 场景，走默认连接）。
 */
@Injectable()
export class DiyStockService {
    constructor(private connection: TransactionalConnection) {}

    async deduct(ctx: RequestContext | undefined, items: StockItem[]): Promise<StockShortage[]> {
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        const deducted: StockItem[] = [];
        const shortages: StockShortage[] = [];
        for (const item of items) {
            const qty = Math.floor(item.qty);
            const result = await repo
                .createQueryBuilder()
                .update(DiyMaterial)
                .set({ stock: () => `stock - ${qty}` })
                .where('id = :id AND stock >= :qty', { id: item.materialId, qty })
                .execute();
            if (result.affected) {
                deducted.push(item);
            } else {
                const material = await repo.findOne({ where: { id: item.materialId } });
                shortages.push({
                    materialId: item.materialId,
                    code: material?.code ?? String(item.materialId),
                    required: qty,
                    available: material?.stock ?? 0,
                });
            }
        }
        if (shortages.length) {
            await this.restock(ctx, deducted);
        }
        return shortages;
    }

    async restock(ctx: RequestContext | undefined, items: StockItem[]): Promise<void> {
        if (!items.length) {
            return;
        }
        const repo = this.connection.getRepository(ctx, DiyMaterial);
        for (const item of items) {
            const qty = Math.floor(item.qty);
            await repo
                .createQueryBuilder()
                .update(DiyMaterial)
                .set({ stock: () => `stock + ${qty}` })
                .where('id = :id', { id: item.materialId })
                .execute();
        }
    }
}
