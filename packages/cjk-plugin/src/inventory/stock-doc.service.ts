import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { OrderStockLedger } from '@vendure/inventory-plugin';
import { StockDocEntity, StockDocType } from './stock-doc.entity';
import { StockDocItemEntity } from './stock-doc-item.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
import { InventoryModeService } from './inventory-mode.service';
import { StorageBinService } from '../storage/storage-bin.service';

const loggerCtx = 'StockDocService';

export interface StockDocItemInput {
    variantId: ID;
    fromStockLocationId?: ID;
    toStockLocationId?: ID;
    qty: number;
    realQty?: number;
    costPrice?: number;
    /** 库位归位（可选）：填写则入库后把该 SKU 归位到该库位 */
    binId?: ID;
    /** 库区归位（可选）：zone 档只填库区 */
    zoneId?: ID;
}

export interface StockDocCreateInput {
    type: StockDocType;
    remark?: string;
    operator?: string;
    items: StockDocItemInput[];
}

/** 流水查询入参（与 GraphQL `stockMovementLedger` 一一对应；新增项全部可选，向后兼容） */
export interface StockDocLedgerQuery {
    productVariantId?: ID;
    locationId?: ID;
    bizType?: string;
    bizCode?: string;
    orderLineId?: ID;
    /** 'in' | 'out'；其它值视为不传 */
    direction?: string;
    /** ISO 时间字符串；非法值视为不传 */
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
}

export interface StockDocLedgerSummary {
    inQty: number;
    outQty: number;
}

export interface StockDocSummaryRow {
    id: string;
    code: string;
    type: string;
    remark: string | null;
    operator: string | null;
    createdAt: string;
    itemCount: number;
    totalQty: number;
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

const DOC_TYPES: StockDocType[] = ['PURCHASE', 'TRANSFER', 'STOCKTAKE', 'ISSUE'];

function parseIso(value?: string | null): Date | null {
    if (!value) {
        return null;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function clampPage(v?: number): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

function clampPageSize(v?: number): number {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.min(100, Math.trunc(n)) : 20;
}

@Injectable()
export class StockDocService {
    constructor(
        private conn: TransactionalConnection,
        private virtualPhysicalStockService: VirtualPhysicalStockService,
        private inventoryModeService: InventoryModeService,
        private storageBinService: StorageBinService,
    ) {}

    /** inventoryMode gate 委托独立服务：odoo 模式只读，禁止直接落库 */
    private assertSimple(ctx: RequestContext): void {
        this.inventoryModeService.assertSimple(ctx);
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
                await this.applyBinBinding(txCtx, doc, it, ei);
                await itemRepo.save(ei);
            }
            Logger.info(`库存单据 ${doc.code}(${doc.type}) 已生效 items=${input.items.length}`, loggerCtx);
            return doc;
        });
    }

    /**
     * 库位归位（可选）：仅在显式传了 binId / zoneId 时写入，
     * 不传 = 与改造前完全一致（向后兼容，现网无感）。
     */
    private async applyBinBinding(
        ctx: RequestContext,
        doc: StockDocEntity,
        input: StockDocItemInput,
        item: StockDocItemEntity,
    ): Promise<void> {
        const binId = input.binId != null ? Number(input.binId) : null;
        const zoneIdInput = input.zoneId != null ? Number(input.zoneId) : null;
        if (!binId && !zoneIdInput) return;

        const stockLocationId = item.toStockLocationId != null ? Number(item.toStockLocationId) : null;
        if (stockLocationId == null) {
            throw new UserInputError(`${doc.code} 库位归位需指定目标仓`);
        }
        const zoneId = zoneIdInput ?? (binId ? await this.storageBinService.binZoneId(ctx, binId) : null);
        if (!zoneId) {
            throw new UserInputError('库位与库区必须至少指定一个');
        }
        await this.storageBinService.bind(ctx, {
            variantId: Number(item.variantId),
            stockLocationId,
            zoneId,
            binId,
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

    /**
     * 流水查询：按当前渠道查 OrderStockLedger。
     * 不复用 `@vendure/inventory-plugin` 的 `StockLedgerService.list()`（它不支持 direction/from/to/summary，
     * 且不宜改动另一个包的 src 与 lib），改为在本服务内自建 QueryBuilder。
     * 渠道 scoping 沿用既有写法（对齐 `pickup-location.service.ts:41` 的 innerJoin channels）。
     */
    async ledger(
        ctx: RequestContext,
        options?: StockDocLedgerQuery,
    ): Promise<{ items: OrderStockLedger[]; totalItems: number; summary: StockDocLedgerSummary }> {
        const page = clampPage(options?.page);
        const pageSize = clampPageSize(options?.pageSize);
        const dir = options?.direction === 'in' || options?.direction === 'out' ? options.direction : null;
        const bizType = options?.bizType ? String(options.bizType) : null;
        const from = parseIso(options?.from);
        const to = parseIso(options?.to);

        const base = () => {
            const qb = this.conn
                .getRepository(ctx, OrderStockLedger)
                .createQueryBuilder('l')
                .innerJoin('l.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId });
            if (options?.productVariantId) {
                qb.andWhere('l.productVariantId = :vid', { vid: Number(options.productVariantId) });
            }
            if (options?.locationId) {
                qb.andWhere('l.stockLocationId = :lid', { lid: Number(options.locationId) });
            }
            if (options?.bizCode) {
                qb.andWhere('l.bizCode = :bc', { bc: String(options.bizCode) });
            }
            if (options?.orderLineId) {
                qb.andWhere('l.orderLineId = :ol', { ol: Number(options.orderLineId) });
            }
            if (bizType) {
                qb.andWhere('l.bizType = :bt', { bt: bizType });
            }
            if (dir) {
                qb.andWhere('l.direction = :dir', { dir });
            }
            if (from) {
                qb.andWhere('l.createdAt >= :from', { from });
            }
            if (to) {
                qb.andWhere('l.createdAt <= :to', { to });
            }
            return qb;
        };

        const [items, totalItems] = await base()
            .orderBy('l.createdAt', 'DESC')
            .addOrderBy('l.id', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();

        // 同条件汇总（不带分页）：入/出合计；一条流水只挂一个渠道，故无需去重
        const agg = await base()
            .select("COALESCE(SUM(CASE WHEN l.direction = 'in' THEN l.quantity ELSE 0 END), 0)", 'inQty')
            .addSelect("COALESCE(SUM(CASE WHEN l.direction = 'out' THEN l.quantity ELSE 0 END), 0)", 'outQty')
            .getRawOne();

        return {
            items,
            totalItems,
            summary: { inQty: Number(agg?.inQty ?? 0), outQty: Number(agg?.outQty ?? 0) },
        };
    }

    /** 单据中心列表：本租户单据（可按类型过滤）+ 每单条数/总数量 */
    async listDocs(
        ctx: RequestContext,
        options?: { type?: string; page?: number; pageSize?: number },
    ): Promise<{ totalItems: number; items: StockDocSummaryRow[] }> {
        const type = options?.type && DOC_TYPES.includes(options.type as StockDocType) ? String(options.type) : null;
        const page = clampPage(options?.page);
        const pageSize = clampPageSize(options?.pageSize);

        const qb = this.conn
            .getRepository(ctx, StockDocEntity)
            .createQueryBuilder('d')
            .where('d.tenantChannelId = :ch', { ch: ctx.channel.code });
        if (type) {
            qb.andWhere('d.type = :t', { t: type });
        }
        const [docs, totalItems] = await qb
            .orderBy('d.createdAt', 'DESC')
            .addOrderBy('d.id', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();

        const ids = docs.map(d => d.id);
        const stats = ids.length
            ? await this.conn
                  .getRepository(ctx, StockDocItemEntity)
                  .createQueryBuilder('i')
                  .select('i.docId', 'docId')
                  .addSelect('COUNT(i.id)', 'itemCount')
                  .addSelect('COALESCE(SUM(i.qty), 0)', 'totalQty')
                  .where('i.docId IN (:...ids)', { ids })
                  .groupBy('i.docId')
                  .getRawMany()
            : [];
        const map: Record<string, { itemCount: number; totalQty: number }> = {};
        for (const s of stats) {
            map[String(s.docId)] = { itemCount: Number(s.itemCount ?? 0), totalQty: Number(s.totalQty ?? 0) };
        }

        return {
            totalItems,
            items: docs.map(d => ({
                id: String(d.id),
                code: d.code,
                type: d.type,
                remark: d.remark ?? null,
                operator: d.operator ?? null,
                createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? ''),
                itemCount: map[String(d.id)]?.itemCount ?? 0,
                totalQty: map[String(d.id)]?.totalQty ?? 0,
            })),
        };
    }
}