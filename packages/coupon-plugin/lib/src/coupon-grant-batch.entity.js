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
exports.CouponGrantBatch = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 沉睡召回批量发放批次（FR-E1）：结果可查询的留痕实体。
 * 每执行一次 couponWinBackGrant 落一条，resultsJson 保存逐人明细（customerId/ok/code/reason）。
 */
let CouponGrantBatch = class CouponGrantBatch extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponGrantBatch = CouponGrantBatch;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponGrantBatch.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponGrantBatch.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 90 }),
    __metadata("design:type", Number)
], CouponGrantBatch.prototype, "days", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponGrantBatch.prototype, "totalSelected", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponGrantBatch.prototype, "issuedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponGrantBatch.prototype, "skippedCount", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], CouponGrantBatch.prototype, "resultsJson", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponGrantBatch.prototype, "operator", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], CouponGrantBatch.prototype, "notified", void 0);
exports.CouponGrantBatch = CouponGrantBatch = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CouponGrantBatch);
//# sourceMappingURL=coupon-grant-batch.entity.js.map