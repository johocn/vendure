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
exports.VariantLocationBinding = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 变体 × 物理仓 绑定。某变体有绑定记录 => 物理驱动变体：
 * 虚拟库存 = Σ 绑定物理仓 onHand（镜像），销售分配只落绑定物理仓。
 */
let VariantLocationBinding = class VariantLocationBinding extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.VariantLocationBinding = VariantLocationBinding;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", Object)
], VariantLocationBinding.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", Object)
], VariantLocationBinding.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], VariantLocationBinding.prototype, "isDefault", void 0);
exports.VariantLocationBinding = VariantLocationBinding = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], VariantLocationBinding);
//# sourceMappingURL=variant-location-binding.entity.js.map