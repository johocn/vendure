import { Injectable } from '@nestjs/common';
import {
    ID,
    ProductVariant,
    ProductVariantTranslation,
    RequestContext,
    StockLevel,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { OrderStockLedger } from '@vendure/inventory-plugin';
import { In } from 'typeorm';
import { resolveSafetyStock } from './alert-rule-math';
import { InventoryAlertRuleService } from './inventory-alert-rule.service';
import { StockDocEntity } from './stock-doc.entity';
import { StockDocItemEntity } from './stock-doc-item.entity';
import {
    bucketOf,
    normalizeStockQuery,
    sortStockRows,
    summarizeStock,
    type StockRowCore,
    type StockSummary,
} from './stock-page-math';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';

export interface InventoryStockPageInput {
    locationId?: ID | null;
    keyword?: string;
    bucket?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
}

const MS_7D = 7 * 24 * 3600 * 1000;

/** 库存明细聚合页（一次请求拿齐 KPI / 分桶计数 / 明细行） */
@Injectable()
export class InventoryStockService {
    constructor(
        private conn: TransactionalConnection,
        private virtualPhysicalStockService: VirtualPhysicalStockService,
        private alertRuleService: InventoryAlertRuleService,
    ) {}

    /**
     * 仓库范围解析：locationId 空 → 本租户仓列表（优先物理仓；无物理仓退回全部仓）；
     * 给定 → 单仓且必须归属本租户，否则拒绝。
     */
    private async resolveLocations(
        ctx: RequestContext,
        locationId?: string | null,
    ): Promise<{ ids: string[]; names: Record<string, string> }> {
        const overview = await this.virtualPhysicalStockService.getTenantInventoryOverview(ctx);
        const names: Record<string, string> = {};
        for (const l of overview.locations) {
            names[String(l.id)] = l.name ?? '';
        }
        const physical = overview.locations.filter(l => l.kind === 'physical').map(l => String(l.id));
        const pool = physical.length ? physical : overview.locations.map(l => String(l.id));
        if (!locationId) {
            return { ids: pool, names };
        }
        if (!pool.includes(String(locationId))) {
            throw new UserInputError('仓库不属于当前租户');
        }
        return { ids: [String(locationId)], names };
    }

    /** 关键词预筛：变体名（任意语言）命中的变体 id 集合 */
    private async nameMatchedVariantIds(ctx: RequestContext, kw: string): Promise<string[]> {
        const rows = await this.conn
            .getRepository(ctx, ProductVariantTranslation)
            .createQueryBuilder('vt')
            .where('LOWER(vt.name) LIKE :kw', { kw })
            .select('vt.baseId', 'baseId')
            .getRawMany();
        return rows.map(r => String(r.baseId));
    }

    /** 关键词预筛：规格（选项名，任意语言）命中的变体 id 集合（避免硬编码 ManyToMany 连接表名） */
    private async optionMatchedVariantIds(ctx: RequestContext, kw: string): Promise<string[]> {
        const rows = await this.conn
            .getRepository(ctx, ProductVariant)
            .createQueryBuilder('v')
            .innerJoin('v.options', 'o')
            .innerJoin('o.translations', 'ot', 'LOWER(ot.name) LIKE :kw', { kw })
            .select('v.id', 'id')
            .getRawMany();
        return rows.map(r => String(r.id));
    }

    /** 按变体聚合现存/占用 + sku/productId（一条 SQL，分组在库内完成） */
    private async loadAggregates(ctx: RequestContext, locationIds: string[], kw: string): Promise<any[]> {
        // 租户无仓时不能生成 `IN ()`（Postgres 语法错误），直接返回空聚合
        if (!locationIds.length) {
            return [];
        }
        const qb = this.conn
            .getRepository(ctx, StockLevel)
            .createQueryBuilder('sl')
            .innerJoin(ProductVariant, 'v', 'v.id = sl.productVariantId')
            // 变体必须属于当前渠道：仓是渠道可见的，但变体未必已分配给该渠道（本店不可售），
            // 列表若带出来会让运营看到「点不动」的行——预警规则保存会以「变体不存在或不属于当前渠道」拒绝。
            .innerJoin('v.channels', 'vch', 'vch.id = :vchId', { vchId: ctx.channelId })
            .select('sl.productVariantId', 'variantId')
            .addSelect('SUM(sl.stockOnHand)', 'onHand')
            .addSelect('SUM(sl.stockAllocated)', 'allocated')
            .addSelect('MAX(v.sku)', 'sku')
            .addSelect('MAX(v.productId)', 'productId')
            .where('sl.stockLocationId IN (:...locationIds)', { locationIds: locationIds.map(Number) })
            .andWhere('v.deletedAt IS NULL')
            .groupBy('sl.productVariantId');

        if (kw) {
            const nameIds = await this.nameMatchedVariantIds(ctx, kw);
            const optIds = await this.optionMatchedVariantIds(ctx, kw);
            const matched = [...new Set([...nameIds, ...optIds])].map(Number).filter(n => Number.isFinite(n));
            const params: any = { kw };
            let cond = 'LOWER(v.sku) LIKE :kw';
            if (matched.length) {
                cond += ' OR v.id IN (:...matchedIds)';
                params.matchedIds = matched;
            }
            qb.andWhere(`(${cond})`, params);
        }
        return qb.getRawMany();
    }

    /** 最近一次采购/移库成本价（分）：按 id 降序后在 TS 端取每变体第一条（避免窗口函数方言差异） */
    private async loadLatestCost(ctx: RequestContext, variantIds: string[]): Promise<Record<string, number>> {
        const map: Record<string, number> = {};
        const ids = variantIds.map(Number).filter(n => Number.isFinite(n));
        if (!ids.length) {
            return map;
        }
        const rows = await this.conn
            .getRepository(ctx, StockDocItemEntity)
            .createQueryBuilder('i')
            .innerJoin(StockDocEntity, 'd', 'd.id = i.docId AND d.tenantChannelId = :ch', { ch: ctx.channel.code })
            .where('i.costPrice IS NOT NULL')
            .andWhere('i.variantId IN (:...ids)', { ids })
            .andWhere('d.type IN (:...types)', { types: ['PURCHASE', 'TRANSFER'] })
            .orderBy('i.id', 'DESC')
            .select(['i.variantId AS variantId', 'i.costPrice AS costPrice'])
            .getRawMany();
        for (const r of rows) {
            const vid = String(r.variantId);
            if (map[vid] === undefined) {
                map[vid] = Number(r.costPrice);
            }
        }
        return map;
    }

    /** 最近一次流水（变体级）+ 近 7 天出库合计（渠道 scoping 与 pickup 一致） */
    private async loadLedgerInfo(
        ctx: RequestContext,
        variantIds: string[],
        locationIds: string[],
        withOutbound: boolean,
    ): Promise<{ map: Record<string, { at: string; direction: string; bizType: string }>; outbound7d: number }> {
        const map: Record<string, { at: string; direction: string; bizType: string }> = {};
        let outbound7d = 0;
        const ids = variantIds.map(Number).filter(n => Number.isFinite(n));
        if (!ids.length || !locationIds.length) {
            return { map, outbound7d };
        }
        const base = () =>
            this.conn
                .getRepository(ctx, OrderStockLedger)
                .createQueryBuilder('l')
                .innerJoin('l.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId })
                .where('l.productVariantId IN (:...ids)', { ids })
                .andWhere('l.stockLocationId IN (:...locs)', { locs: locationIds.map(Number) });

        const rows = await base()
            .orderBy('l.createdAt', 'DESC')
            .addOrderBy('l.id', 'DESC')
            .select([
                'l.productVariantId AS variantId',
                'l.createdAt AS createdAt',
                'l.direction AS direction',
                'l.bizType AS bizType',
            ])
            .getRawMany();
        for (const r of rows) {
            const vid = String(r.variantId);
            if (!map[vid]) {
                map[vid] = {
                    at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ''),
                    direction: String(r.direction ?? ''),
                    bizType: String(r.bizType ?? ''),
                };
            }
        }
        if (withOutbound) {
            const since = new Date(Date.now() - MS_7D);
            const sum = await base()
                .andWhere('l.direction = :dir', { dir: 'out' })
                .andWhere('l.createdAt >= :since', { since })
                .select('COALESCE(SUM(l.quantity), 0)', 'total')
                .getRawOne();
            outbound7d = Number(sum?.total ?? 0);
        }
        return { map, outbound7d };
    }

    /** 页内富化：缩略图（asset.preview）+ 选项文本 + 变体名（按当前语言，缺则首个翻译，再缺则 sku） */
    private async loadEnrich(
        ctx: RequestContext,
        variantIds: string[],
    ): Promise<Record<string, { name: string; optionText: string; thumbnail: string }>> {
        const res: Record<string, { name: string; optionText: string; thumbnail: string }> = {};
        const ids = variantIds.map(Number).filter(n => Number.isFinite(n));
        if (!ids.length) {
            return res;
        }
        const lang = String(ctx.languageCode ?? '');
        const variants = await this.conn.getRepository(ctx, ProductVariant).find({
            where: { id: In(ids) },
            relations: ['translations', 'options', 'options.translations', 'featuredAsset'],
        });
        for (const v of variants) {
            const trs = ((v as any).translations ?? []) as any[];
            const nameHit = trs.find(t => String(t.languageCode) === lang) ?? trs[0];
            const optionText = ((v as any).options ?? [])
                .map((o: any) => {
                    const ots = (o?.translations ?? []) as any[];
                    const hit = ots.find(t => String(t.languageCode) === lang) ?? ots[0];
                    return String(hit?.name ?? '').trim();
                })
                .filter(Boolean)
                .join(' / ');
            res[String(v.id)] = {
                name: String(nameHit?.name ?? '').trim(),
                optionText,
                thumbnail: String((v as any).featuredAsset?.preview ?? ''),
            };
        }
        return res;
    }

    /** 页面主入口：一次请求返回 totalItems + summary + 当前页明细 */
    async page(ctx: RequestContext, input?: InventoryStockPageInput | null): Promise<{
        totalItems: number;
        summary: StockSummary;
        items: StockRowCore[];
    }> {
        const q = normalizeStockQuery(input);
        const { ids: locationIds, names } = await this.resolveLocations(ctx, q.locationId);
        const kw = q.keyword ? `%${q.keyword.toLowerCase()}%` : '';

        const aggregates = await this.loadAggregates(ctx, locationIds, kw);
        const variantIds = aggregates.map(a => String(a.variantId));
        const rules = await this.alertRuleService.rulesForVariants(ctx, variantIds);
        const channelDefault = this.alertRuleService.channelDefault(ctx);
        const cost = await this.loadLatestCost(ctx, variantIds);
        const ledger = await this.loadLedgerInfo(ctx, variantIds, locationIds, true);
        const enrich = await this.loadEnrich(ctx, variantIds);

        const rows: StockRowCore[] = aggregates.map(a => {
            const vid = String(a.variantId);
            const onHand = Number(a.onHand ?? 0);
            const allocated = Number(a.allocated ?? 0);
            const costPrice = cost[vid] ?? null;
            const safetyStock = resolveSafetyStock({
                variantId: vid,
                locationId: q.locationId ?? 0,
                rules,
                channelDefault,
            });
            return {
                variantId: vid,
                productId: a.productId === null || a.productId === undefined ? null : String(a.productId),
                variantName: enrich[vid]?.name || String(a.sku ?? ''),
                sku: String(a.sku ?? ''),
                optionText: enrich[vid]?.optionText ?? '',
                thumbnail: enrich[vid]?.thumbnail ?? '',
                stockLocationId: q.locationId,
                locationName: q.locationId ? (names[q.locationId] ?? '') : null,
                onHand,
                allocated,
                available: onHand - allocated,
                safetyStock,
                value: costPrice !== null ? costPrice * onHand : 0,
                costPrice,
                bucket: bucketOf(onHand, safetyStock),
                lastMovementAt: ledger.map[vid]?.at ?? null,
                lastDirection: ledger.map[vid]?.direction ?? null,
                lastBizType: ledger.map[vid]?.bizType ?? null,
            };
        });

        const summary = summarizeStock(rows, ledger.outbound7d);
        const filtered = q.bucket ? rows.filter(r => r.bucket === q.bucket) : rows;
        const sorted = sortStockRows(filtered, q.sort);
        const totalItems = sorted.length;
        const items = sorted.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
        return { totalItems, summary, items };
    }
}