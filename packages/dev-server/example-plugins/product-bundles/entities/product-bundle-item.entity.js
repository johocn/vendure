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
exports.ProductBundleItem = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const product_bundle_entity_1 = require("./product-bundle.entity");
let ProductBundleItem = class ProductBundleItem extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ProductBundleItem = ProductBundleItem;
__decorate([
    (0, typeorm_1.ManyToOne)(type => core_1.ProductVariant),
    __metadata("design:type", core_1.ProductVariant)
], ProductBundleItem.prototype, "productVariant", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], ProductBundleItem.prototype, "productVariantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(type => product_bundle_entity_1.ProductBundle, bundle => bundle.items),
    __metadata("design:type", product_bundle_entity_1.ProductBundle)
], ProductBundleItem.prototype, "bundle", void 0);
__decorate([
    (0, core_1.EntityId)(),
    __metadata("design:type", Object)
], ProductBundleItem.prototype, "bundleId", void 0);
__decorate([
    (0, core_1.Money)(),
    __metadata("design:type", Number)
], ProductBundleItem.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ProductBundleItem.prototype, "quantity", void 0);
exports.ProductBundleItem = ProductBundleItem = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ProductBundleItem);
//# sourceMappingURL=product-bundle-item.entity.js.map