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
exports.SimpleInventoryAdapter = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const stock_doc_item_entity_1 = require("./stock-doc-item.entity");
/**
 * simple 模式适配器：直接读取本地 stockLevel（物理/虚拟仓 onHand），
 * costPrice 取近期的单据成本价（StockDocItemEntity 最新一条非空 costPrice）。
 */
let SimpleInventoryAdapter = class SimpleInventoryAdapter {
    constructor(stockLevelService, conn) {
        this.stockLevelService = stockLevelService;
        this.conn = conn;
        this.mode = 'simple';
    }
    async fetchStock(ctx, variantId, locationId) {
        if (locationId != null) {
            const level = await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
            return [{ variantId, locationId, onHand: level.stockOnHand }];
        }
        const levels = await this.stockLevelService.getStockLevelsForVariant(ctx, variantId);
        return levels.map(l => ({
            variantId,
            locationId: Number(l.stockLocationId),
            onHand: l.stockOnHand,
        }));
    }
    async fetchCost(ctx, variantId, _locationId) {
        var _a;
        const row = await this.conn
            .getRepository(ctx, stock_doc_item_entity_1.StockDocItemEntity)
            .createQueryBuilder('item')
            .where('item.variantId = :variantId', { variantId })
            .andWhere('item.costPrice IS NOT NULL')
            .orderBy('item.id', 'DESC')
            .getOne();
        return (_a = row === null || row === void 0 ? void 0 : row.costPrice) !== null && _a !== void 0 ? _a : null;
    }
};
exports.SimpleInventoryAdapter = SimpleInventoryAdapter;
exports.SimpleInventoryAdapter = SimpleInventoryAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.StockLevelService,
        core_1.TransactionalConnection])
], SimpleInventoryAdapter);
//# sourceMappingURL=simple-inventory.adapter.js.map