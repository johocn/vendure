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
exports.ProductBundle = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const product_bundle_item_entity_1 = require("./product-bundle-item.entity");
let ProductBundle = class ProductBundle extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ProductBundle = ProductBundle;
__decorate([
    (0, typeorm_1.OneToMany)(type => product_bundle_item_entity_1.ProductBundleItem, item => item.bundle),
    __metadata("design:type", Array)
], ProductBundle.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProductBundle.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProductBundle.prototype, "description", void 0);
exports.ProductBundle = ProductBundle = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], ProductBundle);
//# sourceMappingURL=product-bundle.entity.js.map