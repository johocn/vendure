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
exports.CouponSettlementOrder = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 券结算单（买单券资金流 T1，对标设计文档「服务商分账模式」）：
 * 用户购买券（资金冻结于微信待分账）→ 到店核销 → T+1 生成/提交结算单 → 分账给特约商户。
 * 售出即结算 = 二清红线，故结算单必须以「核销」为唯一前提（redeemRef 关联核销凭证）。
 * 金额单位：分；佣金费率单位：万分比（bp，500 = 5%）。
 */
let CouponSettlementOrder = class CouponSettlementOrder extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponSettlementOrder = CouponSettlementOrder;
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "saleOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "customerCouponId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], CouponSettlementOrder.prototype, "redeemRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "inStoreBillId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "faceAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "commissionRateBp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "commissionAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "netAmount", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], CouponSettlementOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    (0, typeorm_1.Index)({ unique: true }),
    __metadata("design:type", String)
], CouponSettlementOrder.prototype, "settlementNo", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "splitMode", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "splitReceiptNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CouponSettlementOrder.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponSettlementOrder.prototype, "settledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponSettlementOrder.prototype, "paidOutAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponSettlementOrder.prototype, "reversedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "voucherType", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], CouponSettlementOrder.prototype, "remark", void 0);
exports.CouponSettlementOrder = CouponSettlementOrder = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'status'])
    // 一张券实例至多一条结算单（券只能核销一次）——唯一约束防重复出单（风险铁律④）
    ,
    (0, typeorm_1.Unique)(['customerCouponId']),
    __metadata("design:paramtypes", [Object])
], CouponSettlementOrder);
//# sourceMappingURL=coupon-settlement-order.entity.js.map