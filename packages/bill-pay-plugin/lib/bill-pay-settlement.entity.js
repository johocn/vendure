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
exports.BillPaySettlement = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 代买单结算台账（设计文档 §3 SETTLED / §10）。
 *
 * 独立于 cjk-plugin 的 merchant_settlement_ledger：该表消费方不按类型过滤且 orderId 与
 * Vendure Order 共用数字 id 会冲突（§15 护栏「先确认所有 ledger 消费方按类型过滤汇总」
 * 前提不成立），故按纯增量原则自建台账表，月度对账/报表从本表出。
 * 金额单位：分。毛利 = quoteAmount − costAmount（差价模型）。
 */
let BillPaySettlement = class BillPaySettlement extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.BillPaySettlement = BillPaySettlement;
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "billPayOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BillPaySettlement.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BillPaySettlement.prototype, "merchantName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], BillPaySettlement.prototype, "merchantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "quoteAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "actualAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "settleRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "costAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BillPaySettlement.prototype, "grossAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date }),
    __metadata("design:type", Date)
], BillPaySettlement.prototype, "occurredAt", void 0);
exports.BillPaySettlement = BillPaySettlement = __decorate([
    (0, typeorm_1.Entity)('bill_pay_settlement'),
    __metadata("design:paramtypes", [Object])
], BillPaySettlement);
//# sourceMappingURL=bill-pay-settlement.entity.js.map