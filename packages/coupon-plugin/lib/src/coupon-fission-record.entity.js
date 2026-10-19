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
exports.CouponFissionRecord = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
/**
 * 分享裂变记录（FR-C）：
 * 同渠道同被分享者仅一条（唯一索引）——既是「同被分享者同活动仅 1 次」的规则载体，
 * 也是发放幂等（R3）的原子保障：发券与落记录同事务，唯一冲突即整体回滚。
 */
let CouponFissionRecord = class CouponFissionRecord extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponFissionRecord = CouponFissionRecord;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponFissionRecord.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponFissionRecord.prototype, "inviterCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponFissionRecord.prototype, "inviteeCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], CouponFissionRecord.prototype, "inviteeCouponId", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], CouponFissionRecord.prototype, "inviterCouponId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'OK' }),
    __metadata("design:type", String)
], CouponFissionRecord.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponFissionRecord.prototype, "sharedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => customer_coupon_entity_1.CustomerCoupon, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'inviteeCouponId' }),
    __metadata("design:type", customer_coupon_entity_1.CustomerCoupon)
], CouponFissionRecord.prototype, "inviteeCoupon", void 0);
exports.CouponFissionRecord = CouponFissionRecord = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'inviteeCustomerId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], CouponFissionRecord);
//# sourceMappingURL=coupon-fission-record.entity.js.map