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
exports.OrderPaymentSchedule = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 订单级支付计划实例（下单时快照，改配置不影响已生成订单）。
 */
let OrderPaymentSchedule = class OrderPaymentSchedule extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.OrderPaymentSchedule = OrderPaymentSchedule;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], OrderPaymentSchedule.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], OrderPaymentSchedule.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], OrderPaymentSchedule.prototype, "scenario", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], OrderPaymentSchedule.prototype, "deliveryGate", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], OrderPaymentSchedule.prototype, "depositRule", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], OrderPaymentSchedule.prototype, "agreementVersion", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'pending' }),
    __metadata("design:type", String)
], OrderPaymentSchedule.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], OrderPaymentSchedule.prototype, "breachType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], OrderPaymentSchedule.prototype, "shipDeadline", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], OrderPaymentSchedule.prototype, "meta", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], OrderPaymentSchedule.prototype, "channels", void 0);
exports.OrderPaymentSchedule = OrderPaymentSchedule = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], OrderPaymentSchedule);
