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
exports.AffiliateCommissionEntry = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let AffiliateCommissionEntry = class AffiliateCommissionEntry extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.AffiliateCommissionEntry = AffiliateCommissionEntry;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], AffiliateCommissionEntry.prototype, "channels", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "affiliateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "orderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "baseAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "rate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", Number)
], AffiliateCommissionEntry.prototype, "commissionAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'merchant' }),
    __metadata("design:type", String)
], AffiliateCommissionEntry.prototype, "loadOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'pending' }),
    __metadata("design:type", String)
], AffiliateCommissionEntry.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], AffiliateCommissionEntry.prototype, "withdrawalId", void 0);
exports.AffiliateCommissionEntry = AffiliateCommissionEntry = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['orderId', 'orderLineId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], AffiliateCommissionEntry);
//# sourceMappingURL=affiliate-commission.entity.js.map