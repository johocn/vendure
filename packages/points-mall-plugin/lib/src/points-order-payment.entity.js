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
exports.PointsOrderPayment = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 混合价现金支付单（微信），参照 RechargeOrder 的幂等模式 */
let PointsOrderPayment = class PointsOrderPayment extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PointsOrderPayment = PointsOrderPayment;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsOrderPayment.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsOrderPayment.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PointsOrderPayment.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], PointsOrderPayment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], PointsOrderPayment.prototype, "externalRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], PointsOrderPayment.prototype, "transactionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], PointsOrderPayment.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PointsOrderPayment.prototype, "channelId", void 0);
exports.PointsOrderPayment = PointsOrderPayment = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['orderId']),
    __metadata("design:paramtypes", [Object])
], PointsOrderPayment);
//# sourceMappingURL=points-order-payment.entity.js.map