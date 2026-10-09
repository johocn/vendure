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
exports.BalanceWithdrawalRequest = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let BalanceWithdrawalRequest = class BalanceWithdrawalRequest extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.BalanceWithdrawalRequest = BalanceWithdrawalRequest;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BalanceWithdrawalRequest.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], BalanceWithdrawalRequest.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BalanceWithdrawalRequest.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], BalanceWithdrawalRequest.prototype, "accountInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'pending' }),
    __metadata("design:type", String)
], BalanceWithdrawalRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BalanceWithdrawalRequest.prototype, "remark", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], BalanceWithdrawalRequest.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], BalanceWithdrawalRequest.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], BalanceWithdrawalRequest.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BalanceWithdrawalRequest.prototype, "channelId", void 0);
exports.BalanceWithdrawalRequest = BalanceWithdrawalRequest = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], BalanceWithdrawalRequest);
//# sourceMappingURL=balance-withdrawal-request.entity.js.map