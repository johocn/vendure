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
exports.MerchantAgreement = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 商家协议表（P0 轻量）：渠道内按商家名唯一，维护协议结算费率。
 */
let MerchantAgreement = class MerchantAgreement extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MerchantAgreement = MerchantAgreement;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantAgreement.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], MerchantAgreement.prototype, "merchantName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantAgreement.prototype, "settleRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], MerchantAgreement.prototype, "settleMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], MerchantAgreement.prototype, "contact", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], MerchantAgreement.prototype, "note", void 0);
exports.MerchantAgreement = MerchantAgreement = __decorate([
    (0, typeorm_1.Entity)('merchant_agreement'),
    (0, typeorm_1.Index)(['channelId', 'merchantName'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], MerchantAgreement);
//# sourceMappingURL=merchant-agreement.entity.js.map