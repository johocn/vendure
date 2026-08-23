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
exports.PaymentProfile = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 支付方案档案
 *
 * 分为两类：
 * - 全局档案（isGlobal=true）：由超级管理员维护，所有租户可选用
 * - 租户档案（isGlobal=false）：由租户管理员维护，仅本租户可见
 *
 * 租户从档案创建支付方式后，生成的 PaymentMethod 实例与档案完全解耦。
 */
let PaymentProfile = class PaymentProfile extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PaymentProfile = PaymentProfile;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentProfile.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], PaymentProfile.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PaymentProfile.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PaymentProfile.prototype, "isGlobal", void 0);
__decorate([
    (0, core_1.EntityId)({ nullable: true }),
    __metadata("design:type", Object)
], PaymentProfile.prototype, "ownerChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PaymentProfile.prototype, "installmentOptions", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PaymentProfile.prototype, "isTenantDefault", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.PaymentMethod),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], PaymentProfile.prototype, "paymentMethods", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], PaymentProfile.prototype, "channels", void 0);
exports.PaymentProfile = PaymentProfile = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PaymentProfile);
//# sourceMappingURL=payment-profile.entity.js.map