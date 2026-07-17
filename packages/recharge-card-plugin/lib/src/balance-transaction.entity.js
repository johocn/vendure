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
exports.BalanceTransaction = exports.BalanceTransactionType = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
var BalanceTransactionType;
(function (BalanceTransactionType) {
    BalanceTransactionType["RECHARGE"] = "recharge";
    BalanceTransactionType["CONSUME"] = "consume";
    BalanceTransactionType["REFUND"] = "refund";
    BalanceTransactionType["FREEZE"] = "freeze";
    BalanceTransactionType["UNFREEZE"] = "unfreeze";
    BalanceTransactionType["ADJUST"] = "adjust";
})(BalanceTransactionType || (exports.BalanceTransactionType = BalanceTransactionType = {}));
let BalanceTransaction = class BalanceTransaction extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.BalanceTransaction = BalanceTransaction;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BalanceTransaction.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BalanceTransaction.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BalanceTransaction.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BalanceTransaction.prototype, "balanceBefore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BalanceTransaction.prototype, "balanceAfter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], BalanceTransaction.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], BalanceTransaction.prototype, "paymentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], BalanceTransaction.prototype, "rechargeCardId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BalanceTransaction.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], BalanceTransaction.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BalanceTransaction.prototype, "channelId", void 0);
exports.BalanceTransaction = BalanceTransaction = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], BalanceTransaction);
//# sourceMappingURL=balance-transaction.entity.js.map