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
exports.OrderTimeoutTask = exports.TimeoutTaskStatus = exports.TimeoutType = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
var TimeoutType;
(function (TimeoutType) {
    TimeoutType["PAYMENT"] = "payment";
    TimeoutType["FULFILLMENT"] = "fulfillment";
    TimeoutType["RECEIPT"] = "receipt";
    TimeoutType["REVIEW"] = "review";
})(TimeoutType || (exports.TimeoutType = TimeoutType = {}));
var TimeoutTaskStatus;
(function (TimeoutTaskStatus) {
    TimeoutTaskStatus["PENDING"] = "pending";
    TimeoutTaskStatus["EXECUTED"] = "executed";
    TimeoutTaskStatus["CANCELLED"] = "cancelled";
    TimeoutTaskStatus["FAILED"] = "failed";
})(TimeoutTaskStatus || (exports.TimeoutTaskStatus = TimeoutTaskStatus = {}));
let OrderTimeoutTask = class OrderTimeoutTask extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.OrderTimeoutTask = OrderTimeoutTask;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], OrderTimeoutTask.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], OrderTimeoutTask.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], OrderTimeoutTask.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], OrderTimeoutTask.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: TimeoutTaskStatus.PENDING }),
    __metadata("design:type", String)
], OrderTimeoutTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OrderTimeoutTask.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], OrderTimeoutTask.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], OrderTimeoutTask.prototype, "executedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], OrderTimeoutTask.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], OrderTimeoutTask.prototype, "channels", void 0);
exports.OrderTimeoutTask = OrderTimeoutTask = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], OrderTimeoutTask);
//# sourceMappingURL=order-timeout-task.entity.js.map