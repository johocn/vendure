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
exports.ProductCouponBinding = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const coupon_template_entity_1 = require("./coupon-template.entity");
/**
 * 商品绑定券：运营层配置「某商品（可细化到多个 variant）可领取某张券模板」，
 * 结算时按 binding 集合判定订单行是否命中。channelId 用于租户隔离（大整数列）。
 */
let ProductCouponBinding = class ProductCouponBinding extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.ProductCouponBinding = ProductCouponBinding;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ProductCouponBinding.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], ProductCouponBinding.prototype, "variantIds", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ProductCouponBinding.prototype, "couponTemplateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => coupon_template_entity_1.CouponTemplate, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'couponTemplateId' }),
    __metadata("design:type", coupon_template_entity_1.CouponTemplate)
], ProductCouponBinding.prototype, "template", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ProductCouponBinding.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { nullable: true }),
    __metadata("design:type", Number)
], ProductCouponBinding.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ProductCouponBinding.prototype, "displayOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ProductCouponBinding.prototype, "perUserClaimLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ProductCouponBinding.prototype, "claimWindowStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ProductCouponBinding.prototype, "claimWindowEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ProductCouponBinding.prototype, "claimStock", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], ProductCouponBinding.prototype, "badgeText", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], ProductCouponBinding.prototype, "promoTitle", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], ProductCouponBinding.prototype, "remark", void 0);
exports.ProductCouponBinding = ProductCouponBinding = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['productId', 'channelId']),
    (0, typeorm_1.Index)(['couponTemplateId']),
    __metadata("design:paramtypes", [Object])
], ProductCouponBinding);
//# sourceMappingURL=product-coupon-binding.entity.js.map