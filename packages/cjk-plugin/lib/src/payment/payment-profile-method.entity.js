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
exports.PaymentProfileMethod = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 支付档案 × 支付方式 的 join 载荷实体。
 * 存放某一支付方式在某档案下的工作模式（options），如分期：
 * options = { alipay: { huabei: { periods: [...] } } }
 */
let PaymentProfileMethod = class PaymentProfileMethod extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PaymentProfileMethod = PaymentProfileMethod;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentProfileMethod.prototype, "profileId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentProfileMethod.prototype, "paymentMethodId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'installment' }),
    __metadata("design:type", String)
], PaymentProfileMethod.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PaymentProfileMethod.prototype, "options", void 0);
exports.PaymentProfileMethod = PaymentProfileMethod = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PaymentProfileMethod);
//# sourceMappingURL=payment-profile-method.entity.js.map