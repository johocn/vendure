import { Injectable } from '@nestjs/common';
import { ID, Logger, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { In } from 'typeorm';
import { OrderStockLedger } from '@vendure/inventory-plugin';
import { StockDocEntity, StockDocType } from './stock-doc.entity';
import { StockDocItemEntity } from './stock-doc-item.entity';
import { StocktakeTask } from '../stocktake/stocktake-task.entity';
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
    /** 盘点任务反查（D44）：仅盘点任务过账生成的单据有值，手工调数单为 null */
    taskId?: string | null;
    taskCode?: string | null;
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

    /** 单据中心列表：本租户单据（可按类型/仓库/日期/操作人过滤）+ 每单条数/总数量 */
    async listDocs(
        ctx: RequestContext,
        options?: {
            type?: string;
            locationId?: ID;
            from?: string;
            to?: string;
            operator?: string;
            page?: number;
            pageSize?: number;
        },
    ): Promise<{ totalItems: number; items: StockDocSummaryRow[] }> {
        const type = options?.type && DOC_TYPES.includes(options.type as StockDocType) ? String(options.type) : null;
        const page = clampPage(options?.page);
        const pageSize = clampPageSize(options?.pageSize);
        const from = parseIso(options?.from);
        const to = parseIso(options?.to);

        const qb = this.conn
            .getRepository(ctx, StockDocEntity)
            .createQueryBuilder('d')
            .where('d.tenantChannelId = :ch', { ch: ctx.channel.code });
        if (type) {
            qb.andWhere('d.type = :t', { t: type });
        }
        if (options?.locationId) {
            // 单据头无仓库字段：按明细的源/目标仓匹配（EXISTS，避免 join 造成行重复）。
            // 子查询是裸 SQL，Postgres 会把未加引号的标识符折成小写，故 camelCase 列必须加双引号。
            qb.andWhere(
                `EXISTS (SELECT 1 FROM stock_doc_item i WHERE i."docId" = d.id
                         AND (i."fromStockLocationId" = :loc OR i."toStockLocationId" = :loc))`,
                { loc: Number(options.locationId) },
            );
        }
        // 日期区间：必须绑定 Date 实例。`stock_doc.createdAt` 是 timestamp（无时区），
        // 若直接把带 Z 的 ISO 串交给 Postgres，文本→timestamp 转换会丢掉偏移量，口径偏 8 小时。
        if (from) {
            qb.andWhere('d.createdAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('d.createdAt <= :to', { to });
        }
        if (options?.operator) {
            qb.andWhere('d.operator = :op', { op: options.operator });
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

        // 反查「盘点任务过账单」（D44）：stock_doc 侧无任务字段，唯一指针是 stocktake_task.postedStockDocId。
        // 仅当本页确有盘库单时才查一次（其余类型不可能被任务引用）；空数组必须短路，否则 TypeORM 会生成 `IN ()` 报错。
        // 租户键不对称：stock_doc 存渠道 code，stocktake_task 存 String(ctx.channelId)，故不能 join 租户键，只按指针反查 + 租户过滤。
        const taskOfDoc: Record<string, { id: string; code: string }> = {};
        const stocktakeIds = docs.filter(d => d.type === 'STOCKTAKE').map(d => Number(d.id));
        if (stocktakeIds.length) {
            const tasks = await this.conn.getRepository(ctx, StocktakeTask).find({
                where: { tenantChannelId: String(ctx.channelId), postedStockDocId: In(stocktakeIds) },
                select: ['id', 'code', 'postedStockDocId'],
            });
            for (const t of tasks) {
                if (t.postedStockDocId == null) continue;
                taskOfDoc[String(t.postedStockDocId)] = { id: String(t.id), code: t.code };
            }
        }

        return {
            totalItems,
            items: docs.map(d => {
                const task = taskOfDoc[String(d.id)];
                return {
                    id: String(d.id),
                    code: d.code,
                    type: d.type,
                    remark: d.remark ?? null,
                    operator: d.operator ?? null,
                    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? ''),
                    itemCount: map[String(d.id)]?.itemCount ?? 0,
                    totalQty: map[String(d.id)]?.totalQty ?? 0,
                    taskId: task?.id ?? null,
                    taskCode: task?.code ?? null,
                };
            }),
        };
    }

    /**
     * 作业员明细聚合（D46）：按操作人合计「人手执行的库存单据」的单据数与件数。
     * 为什么放在服务端：原先前端取 `listDocs({ pageSize: 100 })` 再在浏览器里过滤 + 聚合，而
     * `clampPageSize` 把 pageSize 硬顶在 100 → 窗口内单据超过 100 条时，按 createdAt DESC 截掉的
     * 是**较老**单据，低频作业员会整行消失、合计系统性偏低。SQL 侧聚合后返回行数 = 操作人数，天然无上限。
     * 口径（与前端 `ops-report` 一致，避免两处各写一套）：排除 `STOCKTAKE` —— 真盘库过账单的人工作业量
     * 已由 `stocktakeStats(taskId)` 的盘次/应盘行口径覆盖；D42 起「库存明细页调整」产生的手工调数单
     * 复用该类型，属数据修正而非作业量。
     * count 用 `COUNT(DISTINCT d.id)`：left join 明细后行数会按明细条数膨胀；**无明细的单据仍计 1 单**
     * （与旧前端口径一致：旧实现按单据逐条累加，totalQty 取明细合计、缺失按 0）。
     * operator 用 COALESCE 折成空串：空串即「未记录操作人」，前端渲染为「未记录」占位，且排序时自然排在最前。
     */
    async operatorStats(
        ctx: RequestContext,
        options?: { from?: string; to?: string },
    ): Promise<Array<{ operator: string; count: number; qty: number }>> {
        const from = parseIso(options?.from);
        const to = parseIso(options?.to);

        const qb = this.conn
            .getRepository(ctx, StockDocEntity)
            .createQueryBuilder('d')
            .leftJoin(StockDocItemEntity, 'i', 'i."docId" = d.id')
            .select(`COALESCE(d.operator, '')`, 'operator')
            .addSelect('COUNT(DISTINCT d.id)', 'count')
            .addSelect('COALESCE(SUM(i.qty), 0)', 'qty')
            .where('d.tenantChannelId = :ch', { ch: ctx.channel.code })
            .andWhere('d.type <> :excluded', { excluded: 'STOCKTAKE' });
        // 日期区间：与 listDocs 同口径，必须绑定 Date 实例（timestamp 无时区，ISO 串直传会丢偏移量）
        if (from) {
            qb.andWhere('d.createdAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('d.createdAt <= :to', { to });
        }
        const rows = await qb
            .groupBy(`COALESCE(d.operator, '')`)
            // 排序与前端渲染口径一致：单据数降序，同数按操作人升序（顺序稳定，不随接口返回抖动）
            .orderBy('COUNT(DISTINCT d.id)', 'DESC')
            .addOrderBy(`COALESCE(d.operator, '')`, 'ASC')
            .getRawMany();

        return rows.map((r) => ({
            operator: String(r.operator ?? ''),
            count: Number(r.count ?? 0),
            qty: Number(r.qty ?? 0),
        }));
    }
}