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
exports.SettlementEntry = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 结算明细：一次按店入账。orderId×shopId 唯一 → 幂等防重。金额「分」整数。 */
let SettlementEntry = class SettlementEntry extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.SettlementEntry = SettlementEntry;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], SettlementEntry.prototype, "orderCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "goodsAmountWithTax", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "shippingAmountWithTax", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "commissionAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], SettlementEntry.prototype, "netAmountWithTax", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], SettlementEntry.prototype, "settledAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], SettlementEntry.prototype, "channels", void 0);
exports.SettlementEntry = SettlementEntry = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['orderId', 'shopId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], SettlementEntry);
//# sourceMappingURL=settlement-entry.entity.js.map