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
exports.CustomerCoupon = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const coupon_template_entity_1 = require("./coupon-template.entity");
/**
 * 用户券：用户领取/被定向发放后的实例。
 */
let CustomerCoupon = class CustomerCoupon extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CustomerCoupon = CustomerCoupon;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CustomerCoupon.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CustomerCoupon.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => coupon_template_entity_1.CouponTemplate, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'templateId' }),
    __metadata("design:type", coupon_template_entity_1.CouponTemplate)
], CustomerCoupon.prototype, "template", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, typeorm_1.Index)({ unique: true }),
    __metadata("design:type", String)
], CustomerCoupon.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'UNUSED' }),
    __metadata("design:type", String)
], CustomerCoupon.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'CENTRE' }),
    __metadata("design:type", String)
], CustomerCoupon.prototype, "issuedBy", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CustomerCoupon.prototype, "reservedOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CustomerCoupon.prototype, "usedOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CustomerCoupon.prototype, "issuedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CustomerCoupon.prototype, "usedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CustomerCoupon.prototype, "expiredAt", void 0);
exports.CustomerCoupon = CustomerCoupon = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['customerId', 'templateId']),
    __metadata("design:paramtypes", [Object])
], CustomerCoupon);
//# sourceMappingURL=customer-coupon.entity.js.map