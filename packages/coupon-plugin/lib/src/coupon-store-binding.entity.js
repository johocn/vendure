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
exports.CouponStoreBinding = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 券模板 ↔ 门店绑定（券可用门店范围）。
 * - type=INCLUDE：可用门店白名单
 * - type=EXCLUDE：在无 INCLUDE 或 INCLUDE 命中后进一步排除的门店
 * 无任何绑定行时视为不限门店（storeCoverage='ALL'），历史券行为完全不变。
 * templateId 可空（预留券包 bundleId 维度），故组合索引不做唯一约束。
 */
let CouponStoreBinding = class CouponStoreBinding extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponStoreBinding = CouponStoreBinding;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponStoreBinding.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponStoreBinding.prototype, "bundleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponStoreBinding.prototype, "merchantId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponStoreBinding.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'INCLUDE' }),
    __metadata("design:type", String)
], CouponStoreBinding.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CouponStoreBinding.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: false }),
    __metadata("design:type", Boolean)
], CouponStoreBinding.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponStoreBinding.prototype, "channelId", void 0);
exports.CouponStoreBinding = CouponStoreBinding = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['templateId', 'storeId']),
    __metadata("design:paramtypes", [Object])
], CouponStoreBinding);
//# sourceMappingURL=coupon-store-binding.entity.js.map