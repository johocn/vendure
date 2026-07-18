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
exports.SupplierStockInTransit = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const supplier_stock_entity_1 = require("./supplier-stock.entity");
/**
 * @description This entity represents a SupplierInTransit information
 *
 * @docsCategory entities
 */
let SupplierStockInTransit = class SupplierStockInTransit extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.SupplierStockInTransit = SupplierStockInTransit;
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SupplierStockInTransit.prototype, "channelName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SupplierStockInTransit.prototype, "channelOrderNo", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierStockInTransit.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_stock_entity_1.SupplierStock, (supplierStock) => supplierStock.stocksInTransits),
    __metadata("design:type", supplier_stock_entity_1.SupplierStock)
], SupplierStockInTransit.prototype, "supplierStock", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Object)
], SupplierStockInTransit.prototype, "supplierStockId", void 0);
exports.SupplierStockInTransit = SupplierStockInTransit = __decorate([
    (0, typeorm_1.Entity)('supplier_stock_in_transit'),
    __metadata("design:paramtypes", [Object])
], SupplierStockInTransit);
//# sourceMappingURL=supplier-stock-in-transit.entity.js.map