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
exports.MerchantAccount = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/** 商家资金账户：一店一账户。金额一律「分」整数。 */
let MerchantAccount = class MerchantAccount extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.MerchantAccount = MerchantAccount;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "commissionRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "availableBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "totalGoodsAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "totalShippingAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "totalCommission", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MerchantAccount.prototype, "totalWithdrawn", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], MerchantAccount.prototype, "channels", void 0);
exports.MerchantAccount = MerchantAccount = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['channelId', 'shopId'], { unique: true }),
    __metadata("design:paramtypes", [Object])
], MerchantAccount);
//# sourceMappingURL=merchant-account.entity.js.map