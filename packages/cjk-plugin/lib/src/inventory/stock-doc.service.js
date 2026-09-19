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
let StockDocService = class StockDocService {
    constructor(conn, virtualPhysicalStockService, stockLedgerService, inventoryModeService) {
        this.conn = conn;
        this.virtualPhysicalStockService = virtualPhysicalStockService;
        this.stockLedgerService = stockLedgerService;
        this.inventoryModeService = inventoryModeService;
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
                await itemRepo.save(ei);
            }
            core_1.Logger.info(`库存单据 ${doc.code}(${doc.type}) 已生效 items=${input.items.length}`, loggerCtx);
            return doc;
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
    /** 流水查询：按当前渠道查 OrderStockLedger（关联 variant/location/bizCode/orderLine），供流水页用 */
    async ledger(ctx, options) {
        return this.stockLedgerService.list(ctx, options);
    }
};
exports.StockDocService = StockDocService;
exports.StockDocService = StockDocService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        virtual_physical_stock_service_1.VirtualPhysicalStockService,
        inventory_plugin_1.StockLedgerService,
        inventory_mode_service_1.InventoryModeService])
], StockDocService);
//# sourceMappingURL=stock-doc.service.js.map