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
exports.PaymentTimeoutTask = exports.PaymentTimeoutStatus = exports.PaymentTimeoutType = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
var PaymentTimeoutType;
(function (PaymentTimeoutType) {
    PaymentTimeoutType["REMIND"] = "REMIND";
    PaymentTimeoutType["CANCEL"] = "CANCEL";
})(PaymentTimeoutType || (exports.PaymentTimeoutType = PaymentTimeoutType = {}));
var PaymentTimeoutStatus;
(function (PaymentTimeoutStatus) {
    PaymentTimeoutStatus["PENDING"] = "PENDING";
    PaymentTimeoutStatus["EXECUTED"] = "EXECUTED";
    PaymentTimeoutStatus["CANCELLED"] = "CANCELLED";
    PaymentTimeoutStatus["FAILED"] = "FAILED";
})(PaymentTimeoutStatus || (exports.PaymentTimeoutStatus = PaymentTimeoutStatus = {}));
/** 待付款定时任务：订单进入 ArrangingPayment 时登记 +10min 提醒 / +15min 取消（时长常量，spec §4.3） */
let PaymentTimeoutTask = class PaymentTimeoutTask extends core_1.VendureEntity {
    constructor(input) { super(input); }
};
exports.PaymentTimeoutTask = PaymentTimeoutTask;
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], PaymentTimeoutTask.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Object)
], PaymentTimeoutTask.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PaymentTimeoutTask.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], PaymentTimeoutTask.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: PaymentTimeoutStatus.PENDING }),
    __metadata("design:type", String)
], PaymentTimeoutTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PaymentTimeoutTask.prototype, "expectedState", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PaymentTimeoutTask.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], PaymentTimeoutTask.prototype, "lastError", void 0);
exports.PaymentTimeoutTask = PaymentTimeoutTask = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PaymentTimeoutTask);
//# sourceMappingURL=payment-timeout.entity.js.map