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
exports.MarketplaceInventoryLedger = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * @description
 * 供销存中间表：记录商品在各销售来源（marketplace / 独立店）下的供给、销售、库存关系的时效性。
 * 为复杂统计提供关联查询（供 Task10 对账使用）。
 *
 * 说明：Vendure v3 中 `Orderable` 仅是一个 `{ position: number }` 接口，并非基类，
 * 因此本实体继承 `VendureEntity`（含 id / createdAt / updatedAt）。
 */
let MarketplaceInventoryLedger = class MarketplaceInventoryLedger extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MarketplaceInventoryLedger = MarketplaceInventoryLedger;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => core_1.ProductVariant, { onDelete: 'CASCADE' }),
    __metadata("design:type", core_1.ProductVariant)
], MarketplaceInventoryLedger.prototype, "variant", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], MarketplaceInventoryLedger.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MarketplaceInventoryLedger.prototype, "merchantChannelId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MarketplaceInventoryLedger.prototype, "saleSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MarketplaceInventoryLedger.prototype, "stockBefore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MarketplaceInventoryLedger.prototype, "stockAfter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MarketplaceInventoryLedger.prototype, "stockDelta", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MarketplaceInventoryLedger.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], MarketplaceInventoryLedger.prototype, "validFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], MarketplaceInventoryLedger.prototype, "validTo", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], MarketplaceInventoryLedger.prototype, "orderId", void 0);
exports.MarketplaceInventoryLedger = MarketplaceInventoryLedger = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], MarketplaceInventoryLedger);
