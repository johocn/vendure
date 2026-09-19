import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { StockLedgerService } from '@vendure/inventory-plugin';
import { StockDocEntity, StockDocType } from './stock-doc.entity';
import { StockDocItemEntity } from './stock-doc-item.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';

const loggerCtx = 'StockDocService';

export interface StockDocItemInput {
    variantId: ID;
    fromStockLocationId?: ID;
    toStockLocationId?: ID;
    qty: number;
    realQty?: number;
    costPrice?: number;
}

export interface StockDocCreateInput {
    type: StockDocType;
    remark?: string;
    operator?: string;
    items: StockDocItemInput[];
}

const CODE_PREFIX: Record<StockDocType, string> = {
    PURCHASE: 'PO',
    TRANSFER: 'TF',
    STOCKTAKE: 'ST',
    ISSUE: 'IS',
};

const BIZ_TYPE: Record<StockDocType, string> = {
    PURCHASE: 'purchase',
    TRANSFER: 'stockMove',
    STOCKTAKE: 'stocktake',
    ISSUE: 'stockOut',
};

@Injectable()
export class StockDocService {
    constructor(
        private conn: TransactionalConnection,
        private virtualPhysicalStockService: VirtualPhysicalStockService,
        private stockLedgerService: StockLedgerService,
    ) {}

    /**
     * inventoryMode gate：odoo 模式只读，禁止直接落库。Task 8 会抽出独立 service，
     * 本轮先在此内联判断（读渠道自定义字段），便于后期平滑替换。
     */
    private assertSimple(ctx: RequestContext): void {
        const mode = String((ctx.channel.customFields as any)?.inventoryMode ?? 'simple');
        if (mode === 'odoo') {
            throw new Error('Odoo 库存模式为只读，禁止直接落库单据');
        }
    }

    /** 生成租户内唯一单号（前缀+时间戳+随机，冲突重试） */
    async nextCode(ctx: RequestContext, type: StockDocType): Promise<string> {
        const prefix = CODE_PREFIX[type];
        const repo = this.conn.getRepository(ctx, StockDocEntity);
        for (let i = 0; i < 3; i++) {
            const stamp = Date.now().toString(36).toUpperCase();
            const rand = Math.floor(Math.random() * 1000)
                .toString(36)
                .toUpperCase()
                .padStart(3, '0');
            const code = `${prefix}-${stamp}-${rand}`;
            const existing = await repo.findOne({ where: { code } });
            if (!existing) {
                return code;
            }
        }
        throw new Error(`单号生成冲突：${prefix}`);
    }

    /** 直接生效：PURCHASE 加目标仓、TRANSFER 源-目标+、STOCKTAKE 按 realQty 覆盖 */
    async create(ctx: RequestContext, input: StockDocCreateInput): Promise<StockDocEntity> {
        this.assertSimple(ctx);
        return this.conn.withTransaction(ctx, async txCtx => {
            const doc = new StockDocEntity();
            doc.type = input.type;
            doc.tenantChannelId = ctx.channel.code;
            doc.code = await this.nextCode(txCtx, input.type);
            doc.remark = input.remark ?? (null as any);
            doc.operator = input.operator || ctx.activeUserId?.toString() || (null as any);
            doc.createdAt = new Date();
            await this.conn.getRepository(txCtx, StockDocEntity).save(doc);

            const itemRepo = this.conn.getRepository(txCtx, StockDocItemEntity);
            for (const it of input.items) {
                const ei = new StockDocItemEntity();
                ei.docId = doc.id;
                ei.variantId = Number(it.variantId);
                ei.fromStockLocationId = it.fromStockLocationId != null ? Number(it.fromStockLocationId) : (null as any);
                ei.toStockLocationId = it.toStockLocationId != null ? Number(it.toStockLocationId) : (null as any);
                ei.qty = it.qty;
                ei.realQty = it.realQty != null ? Number(it.realQty) : (null as any);
                ei.costPrice = it.costPrice != null ? Number(it.costPrice) : (null as any);
                await this.applyMovement(txCtx, doc, ei);
                await itemRepo.save(ei);
            }
            Logger.info(`库存单据 ${doc.code}(${doc.type}) 已生效 items=${input.items.length}`, loggerCtx);
            return doc;
        });
    }

    private async applyMovement(ctx: RequestContext, doc: StockDocEntity, item: StockDocItemEntity): Promise<void> {
        const adjust = this.virtualPhysicalStockService;
        const variantId = item.variantId as ID;
        const bizCode = doc.code;
        const bizType = BIZ_TYPE[doc.type as StockDocType];
        const reason = `${doc.type}#${doc.code}`;

        switch (doc.type as StockDocType) {
            case 'PURCHASE': {
                if (item.toStockLocationId == null) {
                    throw new Error(`${doc.code} 采购入库需指定目标仓`);
                }
                await adjust.adjustPhysicalStock(ctx, variantId, item.toStockLocationId, item.qty, `${reason}:purchase-in`, {
                    bizType: bizType as any,
                    bizCode,
                });
                break;
            }
            case 'TRANSFER': {
                if (item.fromStockLocationId == null || item.toStockLocationId == null) {
                    throw new Error(`${doc.code} 移库需指定源仓与目标仓`);
                }
                await adjust.adjustPhysicalStock(ctx, variantId, item.fromStockLocationId, -item.qty, `${reason}:source-out`, {
                    bizType: bizType as any,
                    bizCode,
                    otherLocationId: item.toStockLocationId,
                });
                await adjust.adjustPhysicalStock(ctx, variantId, item.toStockLocationId, item.qty, `${reason}:target-in`, {
                    bizType: bizType as any,
                    bizCode,
                    otherLocationId: item.fromStockLocationId,
                });
                break;
            }
            case 'STOCKTAKE': {
                if (item.toStockLocationId == null) {
                    throw new Error(`${doc.code} 盘库需指定目标仓`);
                }
                const target = item.realQty ?? item.qty;
                const diff = await adjust.setPhysicalStock(
                    ctx,
                    variantId,
                    item.toStockLocationId,
                    target,
                    `${reason}:reconcile`,
                    { bizType: bizType as any, bizCode },
                );
                item.difference = diff;
                break;
            }
            case 'ISSUE': {
                if (item.fromStockLocationId == null) {
                    throw new Error(`${doc.code} 手动出库需指定源仓`);
                }
                await adjust.adjustPhysicalStock(ctx, variantId, item.fromStockLocationId, -item.qty, `${reason}:issue-out`, {
                    bizType: bizType as any,
                    bizCode,
                });
                break;
            }
        }
    }

    /** 流水查询：按当前渠道查 OrderStockLedger（关联 variant/location/bizCode/orderLine），供流水页用 */
    async ledger(
        ctx: RequestContext,
        options?: {
            productVariantId?: ID;
            locationId?: ID;
            bizCode?: string;
            orderLineId?: ID;
            page?: number;
            pageSize?: number;
        },
    ): Promise<{ items: any[]; totalItems: number }> {
        return this.stockLedgerService.list(ctx, options);
    }
}