"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryStockService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const typeorm_1 = require("typeorm");
const alert_rule_math_1 = require("./alert-rule-math");
const inventory_alert_rule_service_1 = require("./inventory-alert-rule.service");
const stock_doc_entity_1 = require("./stock-doc.entity");
const stock_doc_item_entity_1 = require("./stock-doc-item.entity");
const stock_page_math_1 = require("./stock-page-math");
const virtual_physical_stock_service_1 = require("./virtual-physical-stock.service");
const MS_7D = 7 * 24 * 3600 * 1000;
/** 库存明细聚合页（一次请求拿齐 KPI / 分桶计数 / 明细行） */
let InventoryStockService = class InventoryStockService {
    constructor(conn, virtualPhysicalStockService, alertRuleService) {
        this.conn = conn;
        this.virtualPhysicalStockService = virtualPhysicalStockService;
        this.alertRuleService = alertRuleService;
    }
    /**
     * 仓库范围解析：locationId 空 → 本租户仓列表（优先物理仓；无物理仓退回全部仓）；
     * 给定 → 单仓且必须归属本租户，否则拒绝。
     */
    async resolveLocations(ctx, locationId) {
        var _a;
        const overview = await this.virtualPhysicalStockService.getTenantInventoryOverview(ctx);
        const names = {};
        for (const l of overview.locations) {
            names[String(l.id)] = (_a = l.name) !== null && _a !== void 0 ? _a : '';
        }
        const physical = overview.locations.filter(l => l.kind === 'physical').map(l => String(l.id));
        const pool = physical.length ? physical : overview.locations.map(l => String(l.id));
        if (!locationId) {
            return { ids: pool, names };
        }
        if (!pool.includes(String(locationId))) {
            throw new core_1.UserInputError('仓库不属于当前租户');
        }
        return { ids: [String(locationId)], names };
    }
    /** 关键词预筛：变体名（任意语言）命中的变体 id 集合 */
    async nameMatchedVariantIds(ctx, kw) {
        const rows = await this.conn
            .getRepository(ctx, core_1.ProductVariantTranslation)
            .createQueryBuilder('vt')
            .where('LOWER(vt.name) LIKE :kw', { kw })
            .select('vt.baseId', 'baseId')
            .getRawMany();
        return rows.map(r => String(r.baseId));
    }
    /** 关键词预筛：规格（选项名，任意语言）命中的变体 id 集合（避免硬编码 ManyToMany 连接表名） */
    async optionMatchedVariantIds(ctx, kw) {
        const rows = await this.conn
            .getRepository(ctx, core_1.ProductVariant)
            .createQueryBuilder('v')
            .innerJoin('v.options', 'o')
            .innerJoin('o.translations', 'ot', 'LOWER(ot.name) LIKE :kw', { kw })
            .select('v.id', 'id')
            .getRawMany();
        return rows.map(r => String(r.id));
    }
    /** 按变体聚合现存/占用 + sku/productId（一条 SQL，分组在库内完成） */
    async loadAggregates(ctx, locationIds, kw) {
        // 租户无仓时不能生成 `IN ()`（Postgres 语法错误），直接返回空聚合
        if (!locationIds.length) {
            return [];
        }
        const qb = this.conn
            .getRepository(ctx, core_1.StockLevel)
            .createQueryBuilder('sl')
            .innerJoin(core_1.ProductVariant, 'v', 'v.id = sl.productVariantId')
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
            const params = { kw };
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
    async loadLatestCost(ctx, variantIds) {
        const map = {};
        const ids = variantIds.map(Number).filter(n => Number.isFinite(n));
        if (!ids.length) {
            return map;
        }
        const rows = await this.conn
            .getRepository(ctx, stock_doc_item_entity_1.StockDocItemEntity)
            .createQueryBuilder('i')
            .innerJoin(stock_doc_entity_1.StockDocEntity, 'd', 'd.id = i.docId AND d.tenantChannelId = :ch', { ch: ctx.channel.code })
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
    async loadLedgerInfo(ctx, variantIds, locationIds, withOutbound) {
        var _a, _b, _c, _d;
        const map = {};
        let outbound7d = 0;
        const ids = variantIds.map(Number).filter(n => Number.isFinite(n));
        if (!ids.length || !locationIds.length) {
            return { map, outbound7d };
        }
        const base = () => this.conn
            .getRepository(ctx, inventory_plugin_1.OrderStockLedger)
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
                    at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String((_a = r.createdAt) !== null && _a !== void 0 ? _a : ''),
                    direction: String((_b = r.direction) !== null && _b !== void 0 ? _b : ''),
                    bizType: String((_c = r.bizType) !== null && _c !== void 0 ? _c : ''),
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
            outbound7d = Number((_d = sum === null || sum === void 0 ? void 0 : sum.total) !== null && _d !== void 0 ? _d : 0);
        }
        return { map, outbound7d };
    }
    /** 页内富化：缩略图（asset.preview）+ 选项文本 + 变体名（按当前语言，缺则首个翻译，再缺则 sku） */
    async loadEnrich(ctx, variantIds) {
        var _a, _b, _c, _d, _e, _f, _g;
        const res = {};
        const ids = variantIds.map(Number).filter(n => Number.isFinite(n));
        if (!ids.length) {
            return res;
        }
        const lang = String((_a = ctx.languageCode) !== null && _a !== void 0 ? _a : '');
        const variants = await this.conn.getRepository(ctx, core_1.ProductVariant).find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: ['translations', 'options', 'options.translations', 'featuredAsset'],
        });
        for (const v of variants) {
            const trs = ((_b = v.translations) !== null && _b !== void 0 ? _b : []);
            const nameHit = (_c = trs.find(t => String(t.languageCode) === lang)) !== null && _c !== void 0 ? _c : trs[0];
            const optionText = ((_d = v.options) !== null && _d !== void 0 ? _d : [])
                .map((o) => {
                var _a, _b, _c;
                const ots = ((_a = o === null || o === void 0 ? void 0 : o.translations) !== null && _a !== void 0 ? _a : []);
                const hit = (_b = ots.find(t => String(t.languageCode) === lang)) !== null && _b !== void 0 ? _b : ots[0];
                return String((_c = hit === null || hit === void 0 ? void 0 : hit.name) !== null && _c !== void 0 ? _c : '').trim();
            })
                .filter(Boolean)
                .join(' / ');
            res[String(v.id)] = {
                name: String((_e = nameHit === null || nameHit === void 0 ? void 0 : nameHit.name) !== null && _e !== void 0 ? _e : '').trim(),
                optionText,
                thumbnail: String((_g = (_f = v.featuredAsset) === null || _f === void 0 ? void 0 : _f.preview) !== null && _g !== void 0 ? _g : ''),
            };
        }
        return res;
    }
    /** 页面主入口：一次请求返回 totalItems + summary + 当前页明细 */
    async page(ctx, input) {
        const q = (0, stock_page_math_1.normalizeStockQuery)(input);
        const { ids: locationIds, names } = await this.resolveLocations(ctx, q.locationId);
        const kw = q.keyword ? `%${q.keyword.toLowerCase()}%` : '';
        const aggregates = await this.loadAggregates(ctx, locationIds, kw);
        const variantIds = aggregates.map(a => String(a.variantId));
        const rules = await this.alertRuleService.rulesForVariants(ctx, variantIds);
        const channelDefault = this.alertRuleService.channelDefault(ctx);
        const cost = await this.loadLatestCost(ctx, variantIds);
        const ledger = await this.loadLedgerInfo(ctx, variantIds, locationIds, true);
        const enrich = await this.loadEnrich(ctx, variantIds);
        const rows = aggregates.map(a => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            const vid = String(a.variantId);
            const onHand = Number((_a = a.onHand) !== null && _a !== void 0 ? _a : 0);
            const allocated = Number((_b = a.allocated) !== null && _b !== void 0 ? _b : 0);
            const costPrice = (_c = cost[vid]) !== null && _c !== void 0 ? _c : null;
            const safetyStock = (0, alert_rule_math_1.resolveSafetyStock)({
                variantId: vid,
                locationId: (_d = q.locationId) !== null && _d !== void 0 ? _d : 0,
                rules,
                channelDefault,
            });
            return {
                variantId: vid,
                productId: a.productId === null || a.productId === undefined ? null : String(a.productId),
                variantName: ((_e = enrich[vid]) === null || _e === void 0 ? void 0 : _e.name) || String((_f = a.sku) !== null && _f !== void 0 ? _f : ''),
                sku: String((_g = a.sku) !== null && _g !== void 0 ? _g : ''),
                optionText: (_j = (_h = enrich[vid]) === null || _h === void 0 ? void 0 : _h.optionText) !== null && _j !== void 0 ? _j : '',
                thumbnail: (_l = (_k = enrich[vid]) === null || _k === void 0 ? void 0 : _k.thumbnail) !== null && _l !== void 0 ? _l : '',
                stockLocationId: q.locationId,
                locationName: q.locationId ? ((_m = names[q.locationId]) !== null && _m !== void 0 ? _m : '') : null,
                onHand,
                allocated,
                available: onHand - allocated,
                safetyStock,
                value: costPrice !== null ? costPrice * onHand : 0,
                costPrice,
                bucket: (0, stock_page_math_1.bucketOf)(onHand, safetyStock),
                lastMovementAt: (_p = (_o = ledger.map[vid]) === null || _o === void 0 ? void 0 : _o.at) !== null && _p !== void 0 ? _p : null,
                lastDirection: (_r = (_q = ledger.map[vid]) === null || _q === void 0 ? void 0 : _q.direction) !== null && _r !== void 0 ? _r : null,
                lastBizType: (_t = (_s = ledger.map[vid]) === null || _s === void 0 ? void 0 : _s.bizType) !== null && _t !== void 0 ? _t : null,
            };
        });
        const summary = (0, stock_page_math_1.summarizeStock)(rows, ledger.outbound7d);
        const filtered = q.bucket ? rows.filter(r => r.bucket === q.bucket) : rows;
        const sorted = (0, stock_page_math_1.sortStockRows)(filtered, q.sort);
        const totalItems = sorted.length;
        const items = sorted.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
        return { totalItems, summary, items };
    }
};
exports.InventoryStockService = InventoryStockService;
exports.InventoryStockService = InventoryStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        virtual_physical_stock_service_1.VirtualPhysicalStockService,
        inventory_alert_rule_service_1.InventoryAlertRuleService])
], InventoryStockService);
//# sourceMappingURL=inventory-stock.service.js.map