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
exports.StockDocService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const inventory_plugin_1 = require("@vendure/inventory-plugin");
const stock_doc_entity_1 = require("./stock-doc.entity");
const stock_doc_item_entity_1 = require("./stock-doc-item.entity");
const virtual_physical_stock_service_1 = require("./virtual-physical-stock.service");
const inventory_mode_service_1 = require("./inventory-mode.service");
const storage_bin_service_1 = require("../storage/storage-bin.service");
const loggerCtx = 'StockDocService';
const CODE_PREFIX = {
    PURCHASE: 'PO',
    TRANSFER: 'TF',
    STOCKTAKE: 'ST',
    ISSUE: 'IS',
};
const BIZ_TYPE = {
    PURCHASE: 'purchase',
    TRANSFER: 'stockMove',
    STOCKTAKE: 'stocktake',
    ISSUE: 'stockOut',
};
const DOC_TYPES = ['PURCHASE', 'TRANSFER', 'STOCKTAKE', 'ISSUE'];
function parseIso(value) {
    if (!value) {
        return null;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
function clampPage(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}
function clampPageSize(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.min(100, Math.trunc(n)) : 20;
}
let StockDocService = class StockDocService {
    constructor(conn, virtualPhysicalStockService, inventoryModeService, storageBinService) {
        this.conn = conn;
        this.virtualPhysicalStockService = virtualPhysicalStockService;
        this.inventoryModeService = inventoryModeService;
        this.storageBinService = storageBinService;
    }
    /** inventoryMode gate 委托独立服务：odoo 模式只读，禁止直接落库 */
    assertSimple(ctx) {
        this.inventoryModeService.assertSimple(ctx);
    }
    /** 生成租户内唯一单号（前缀+时间戳+随机，冲突重试） */
    async nextCode(ctx, type) {
        const prefix = CODE_PREFIX[type];
        const repo = this.conn.getRepository(ctx, stock_doc_entity_1.StockDocEntity);
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
    async create(ctx, input) {
        this.assertSimple(ctx);
        return this.conn.withTransaction(ctx, async (txCtx) => {
            var _a, _b;
            const doc = new stock_doc_entity_1.StockDocEntity();
            doc.type = input.type;
            doc.tenantChannelId = ctx.channel.code;
            doc.code = await this.nextCode(txCtx, input.type);
            doc.remark = (_a = input.remark) !== null && _a !== void 0 ? _a : null;
            doc.operator = input.operator || ((_b = ctx.activeUserId) === null || _b === void 0 ? void 0 : _b.toString()) || null;
            doc.createdAt = new Date();
            await this.conn.getRepository(txCtx, stock_doc_entity_1.StockDocEntity).save(doc);
            const itemRepo = this.conn.getRepository(txCtx, stock_doc_item_entity_1.StockDocItemEntity);
            for (const it of input.items) {
                const ei = new stock_doc_item_entity_1.StockDocItemEntity();
                ei.docId = doc.id;
                ei.variantId = Number(it.variantId);
                ei.fromStockLocationId = it.fromStockLocationId != null ? Number(it.fromStockLocationId) : null;
                ei.toStockLocationId = it.toStockLocationId != null ? Number(it.toStockLocationId) : null;
                ei.qty = it.qty;
                ei.realQty = it.realQty != null ? Number(it.realQty) : null;
                ei.costPrice = it.costPrice != null ? Number(it.costPrice) : null;
                await this.applyMovement(txCtx, doc, ei);
                await this.applyBinBinding(txCtx, doc, it, ei);
                await itemRepo.save(ei);
            }
            core_1.Logger.info(`库存单据 ${doc.code}(${doc.type}) 已生效 items=${input.items.length}`, loggerCtx);
            return doc;
        });
    }
    /**
     * 库位归位（可选）：仅在显式传了 binId / zoneId 时写入，
     * 不传 = 与改造前完全一致（向后兼容，现网无感）。
     */
    async applyBinBinding(ctx, doc, input, item) {
        const binId = input.binId != null ? Number(input.binId) : null;
        const zoneIdInput = input.zoneId != null ? Number(input.zoneId) : null;
        if (!binId && !zoneIdInput)
            return;
        const stockLocationId = item.toStockLocationId != null ? Number(item.toStockLocationId) : null;
        if (stockLocationId == null) {
            throw new core_1.UserInputError(`${doc.code} 库位归位需指定目标仓`);
        }
        const zoneId = zoneIdInput !== null && zoneIdInput !== void 0 ? zoneIdInput : (binId ? await this.storageBinService.binZoneId(ctx, binId) : null);
        if (!zoneId) {
            throw new core_1.UserInputError('库位与库区必须至少指定一个');
        }
        await this.storageBinService.bind(ctx, {
            variantId: Number(item.variantId),
            stockLocationId,
            zoneId,
            binId,
        });
    }
    async applyMovement(ctx, doc, item) {
        var _a;
        const adjust = this.virtualPhysicalStockService;
        const variantId = item.variantId;
        const bizCode = doc.code;
        const bizType = BIZ_TYPE[doc.type];
        const reason = `${doc.type}#${doc.code}`;
        switch (doc.type) {
            case 'PURCHASE': {
                if (item.toStockLocationId == null) {
                    throw new Error(`${doc.code} 采购入库需指定目标仓`);
                }
                await adjust.adjustPhysicalStock(ctx, variantId, item.toStockLocationId, item.qty, `${reason}:purchase-in`, {
                    bizType: bizType,
                    bizCode,
                });
                break;
            }
            case 'TRANSFER': {
                if (item.fromStockLocationId == null || item.toStockLocationId == null) {
                    throw new Error(`${doc.code} 移库需指定源仓与目标仓`);
                }
                await adjust.adjustPhysicalStock(ctx, variantId, item.fromStockLocationId, -item.qty, `${reason}:source-out`, {
                    bizType: bizType,
                    bizCode,
                    otherLocationId: item.toStockLocationId,
                });
                await adjust.adjustPhysicalStock(ctx, variantId, item.toStockLocationId, item.qty, `${reason}:target-in`, {
                    bizType: bizType,
                    bizCode,
                    otherLocationId: item.fromStockLocationId,
                });
                break;
            }
            case 'STOCKTAKE': {
                if (item.toStockLocationId == null) {
                    throw new Error(`${doc.code} 盘库需指定目标仓`);
                }
                const target = (_a = item.realQty) !== null && _a !== void 0 ? _a : item.qty;
                const diff = await adjust.setPhysicalStock(ctx, variantId, item.toStockLocationId, target, `${reason}:reconcile`, { bizType: bizType, bizCode });
                item.difference = diff;
                break;
            }
            case 'ISSUE': {
                if (item.fromStockLocationId == null) {
                    throw new Error(`${doc.code} 手动出库需指定源仓`);
                }
                await adjust.adjustPhysicalStock(ctx, variantId, item.fromStockLocationId, -item.qty, `${reason}:issue-out`, {
                    bizType: bizType,
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
    async ledger(ctx, options) {
        var _a, _b;
        const page = clampPage(options === null || options === void 0 ? void 0 : options.page);
        const pageSize = clampPageSize(options === null || options === void 0 ? void 0 : options.pageSize);
        const dir = (options === null || options === void 0 ? void 0 : options.direction) === 'in' || (options === null || options === void 0 ? void 0 : options.direction) === 'out' ? options.direction : null;
        const bizType = (options === null || options === void 0 ? void 0 : options.bizType) ? String(options.bizType) : null;
        const from = parseIso(options === null || options === void 0 ? void 0 : options.from);
        const to = parseIso(options === null || options === void 0 ? void 0 : options.to);
        const base = () => {
            const qb = this.conn
                .getRepository(ctx, inventory_plugin_1.OrderStockLedger)
                .createQueryBuilder('l')
                .innerJoin('l.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId });
            if (options === null || options === void 0 ? void 0 : options.productVariantId) {
                qb.andWhere('l.productVariantId = :vid', { vid: Number(options.productVariantId) });
            }
            if (options === null || options === void 0 ? void 0 : options.locationId) {
                qb.andWhere('l.stockLocationId = :lid', { lid: Number(options.locationId) });
            }
            if (options === null || options === void 0 ? void 0 : options.bizCode) {
                qb.andWhere('l.bizCode = :bc', { bc: String(options.bizCode) });
            }
            if (options === null || options === void 0 ? void 0 : options.orderLineId) {
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
            summary: { inQty: Number((_a = agg === null || agg === void 0 ? void 0 : agg.inQty) !== null && _a !== void 0 ? _a : 0), outQty: Number((_b = agg === null || agg === void 0 ? void 0 : agg.outQty) !== null && _b !== void 0 ? _b : 0) },
        };
    }
    /** 单据中心列表：本租户单据（可按类型/仓库/日期/操作人过滤）+ 每单条数/总数量 */
    async listDocs(ctx, options) {
        var _a, _b;
        const type = (options === null || options === void 0 ? void 0 : options.type) && DOC_TYPES.includes(options.type) ? String(options.type) : null;
        const page = clampPage(options === null || options === void 0 ? void 0 : options.page);
        const pageSize = clampPageSize(options === null || options === void 0 ? void 0 : options.pageSize);
        const from = parseIso(options === null || options === void 0 ? void 0 : options.from);
        const to = parseIso(options === null || options === void 0 ? void 0 : options.to);
        const qb = this.conn
            .getRepository(ctx, stock_doc_entity_1.StockDocEntity)
            .createQueryBuilder('d')
            .where('d.tenantChannelId = :ch', { ch: ctx.channel.code });
        if (type) {
            qb.andWhere('d.type = :t', { t: type });
        }
        if (options === null || options === void 0 ? void 0 : options.locationId) {
            // 单据头无仓库字段：按明细的源/目标仓匹配（EXISTS，避免 join 造成行重复）。
            // 子查询是裸 SQL，Postgres 会把未加引号的标识符折成小写，故 camelCase 列必须加双引号。
            qb.andWhere(`EXISTS (SELECT 1 FROM stock_doc_item i WHERE i."docId" = d.id
                         AND (i."fromStockLocationId" = :loc OR i."toStockLocationId" = :loc))`, { loc: Number(options.locationId) });
        }
        // 日期区间：必须绑定 Date 实例。`stock_doc.createdAt` 是 timestamp（无时区），
        // 若直接把带 Z 的 ISO 串交给 Postgres，文本→timestamp 转换会丢掉偏移量，口径偏 8 小时。
        if (from) {
            qb.andWhere('d.createdAt >= :from', { from });
        }
        if (to) {
            qb.andWhere('d.createdAt <= :to', { to });
        }
        if (options === null || options === void 0 ? void 0 : options.operator) {
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
                .getRepository(ctx, stock_doc_item_entity_1.StockDocItemEntity)
                .createQueryBuilder('i')
                .select('i.docId', 'docId')
                .addSelect('COUNT(i.id)', 'itemCount')
                .addSelect('COALESCE(SUM(i.qty), 0)', 'totalQty')
                .where('i.docId IN (:...ids)', { ids })
                .groupBy('i.docId')
                .getRawMany()
            : [];
        const map = {};
        for (const s of stats) {
            map[String(s.docId)] = { itemCount: Number((_a = s.itemCount) !== null && _a !== void 0 ? _a : 0), totalQty: Number((_b = s.totalQty) !== null && _b !== void 0 ? _b : 0) };
        }
        return {
            totalItems,
            items: docs.map(d => {
                var _a, _b, _c, _d, _e, _f, _g;
                return ({
                    id: String(d.id),
                    code: d.code,
                    type: d.type,
                    remark: (_a = d.remark) !== null && _a !== void 0 ? _a : null,
                    operator: (_b = d.operator) !== null && _b !== void 0 ? _b : null,
                    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String((_c = d.createdAt) !== null && _c !== void 0 ? _c : ''),
                    itemCount: (_e = (_d = map[String(d.id)]) === null || _d === void 0 ? void 0 : _d.itemCount) !== null && _e !== void 0 ? _e : 0,
                    totalQty: (_g = (_f = map[String(d.id)]) === null || _f === void 0 ? void 0 : _f.totalQty) !== null && _g !== void 0 ? _g : 0,
                });
            }),
        };
    }
};
exports.StockDocService = StockDocService;
exports.StockDocService = StockDocService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        virtual_physical_stock_service_1.VirtualPhysicalStockService,
        inventory_mode_service_1.InventoryModeService,
        storage_bin_service_1.StorageBinService])
], StockDocService);
//# sourceMappingURL=stock-doc.service.js.map