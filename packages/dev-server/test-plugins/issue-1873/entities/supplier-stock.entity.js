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
exports.SupplierStock = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const supplier_stock_in_transit_entity_1 = require("./supplier-stock-in-transit.entity");
/**
 * @description This entity represents a supplier virtual stock
 *
 * @docsCategory entities
 */
let SupplierStock = class SupplierStock extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.SupplierStock = SupplierStock;
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], SupplierStock.prototype, "stockOnHand", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], SupplierStock.prototype, "virtualStock", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], SupplierStock.prototype, "inTransitsStock", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SupplierStock.prototype, "stockArea", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => supplier_stock_in_transit_entity_1.SupplierStockInTransit, (type) => type.supplierStock),
    __metadata("design:type", Array)
], SupplierStock.prototype, "stocksInTransits", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], SupplierStock.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SupplierStock.prototype, "link", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'simple-json' }),
    __metadata("design:type", Array)
], SupplierStock.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinytext', nullable: true }),
    __metadata("design:type", String)
], SupplierStock.prototype, "comment", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.ProductVariant, { onDelete: 'CASCADE' }),
    __metadata("design:type", core_1.ProductVariant)
], SupplierStock.prototype, "productVariant", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], SupplierStock.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Product, { onDelete: 'CASCADE' }),
    __metadata("design:type", core_1.Product)
], SupplierStock.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], SupplierStock.prototype, "productId", void 0);
exports.SupplierStock = SupplierStock = __decorate([
    (0, typeorm_1.Entity)('supplier_stock'),
    __metadata("design:paramtypes", [Object])
], SupplierStock);
//# sourceMappingURL=supplier-stock.entity.js.map