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
exports.CouponSettlementReconcileDiff = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 结算对账差异（买单券资金流 T5）：
 * 每轮对账（runId）把差异落表；台账页默认展示最新一轮的未解决差异。
 * 上一轮未解决差异在新一轮跑批时被整体替换（对账语义 = 当前快照），
 * 已人工处理（resolvedAt 非空）的记录保留作审计。
 */
let CouponSettlementReconcileDiff = class CouponSettlementReconcileDiff extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponSettlementReconcileDiff = CouponSettlementReconcileDiff;
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], CouponSettlementReconcileDiff.prototype, "runId", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], CouponSettlementReconcileDiff.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementReconcileDiff.prototype, "settlementOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementReconcileDiff.prototype, "settlementNo", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], CouponSettlementReconcileDiff.prototype, "diffType", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], CouponSettlementReconcileDiff.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementReconcileDiff.prototype, "detail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponSettlementReconcileDiff.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementReconcileDiff.prototype, "remark", void 0);
exports.CouponSettlementReconcileDiff = CouponSettlementReconcileDiff = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'runId']),
    (0, typeorm_1.Index)(['channelId', 'severity']),
    __metadata("design:paramtypes", [Object])
], CouponSettlementReconcileDiff);
//# sourceMappingURL=coupon-settlement-reconcile-diff.entity.js.map