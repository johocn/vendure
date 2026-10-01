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
exports.InStoreBill = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 到店买单流水：平台不收款、不生成线上订单，仅记录「商户线下收款 + 用券优惠」留痕。
 * 冗余券名/顾客名/折扣等快照，模板或顾客改名后仍可追溯。
 */
let InStoreBill = class InStoreBill extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.InStoreBill = InStoreBill;
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Object)
], InStoreBill.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "customerCouponId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], InStoreBill.prototype, "couponCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "couponTemplateId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], InStoreBill.prototype, "couponName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], InStoreBill.prototype, "customerName", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], InStoreBill.prototype, "customerPhone", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], InStoreBill.prototype, "discountType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "discountValue", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "originalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "discountAmount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "finalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], InStoreBill.prototype, "operatorId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], InStoreBill.prototype, "operatorName", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", String)
], InStoreBill.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], InStoreBill.prototype, "billedAt", void 0);
exports.InStoreBill = InStoreBill = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'billedAt']),
    __metadata("design:paramtypes", [Object])
], InStoreBill);
//# sourceMappingURL=in-store-bill.entity.js.map