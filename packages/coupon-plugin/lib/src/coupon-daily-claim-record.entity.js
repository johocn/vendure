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
exports.CouponDailyClaimRecord = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 每日领券记录（FR-F1）：同渠道同人同券同「业务日」仅一条（唯一索引）——
 * 既是「每人每券每天 1 张」的规则载体，也是发放幂等（R3）的原子保障：
 * 发券与落记录同事务，唯一冲突即整体回滚（claimDate 为 UTC+8 业务日）。
 */
let CouponDailyClaimRecord = class CouponDailyClaimRecord extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponDailyClaimRecord = CouponDailyClaimRecord;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponDailyClaimRecord.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponDailyClaimRecord.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponDailyClaimRecord.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 10 }),
    __metadata("design:type", String)
], CouponDailyClaimRecord.prototype, "claimDate", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], CouponDailyClaimRecord.prototype, "couponId", void 0);
exports.CouponDailyClaimRecord = CouponDailyClaimRecord = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'customerId', 'templateId', 'claimDate'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], CouponDailyClaimRecord);
//# sourceMappingURL=coupon-daily-claim-record.entity.js.map