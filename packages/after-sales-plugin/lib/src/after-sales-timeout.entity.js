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
exports.AfterSalesTimeoutTask = exports.AfterSalesTimeoutStatus = exports.AfterSalesTimeoutType = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** 售后自动化任务类型 */
var AfterSalesTimeoutType;
(function (AfterSalesTimeoutType) {
    /** Pending 超时提醒商家 */
    AfterSalesTimeoutType["PENDING_REMIND"] = "pending_remind";
    /** Pending 超时自动同意（0 小时配置 = 不创建） */
    AfterSalesTimeoutType["PENDING_AUTO_APPROVE"] = "pending_auto_approve";
    /** RefundFailed 自动重试（0 次配置 = 不创建） */
    AfterSalesTimeoutType["REFUND_RETRY"] = "refund_retry";
})(AfterSalesTimeoutType || (exports.AfterSalesTimeoutType = AfterSalesTimeoutType = {}));
var AfterSalesTimeoutStatus;
(function (AfterSalesTimeoutStatus) {
    AfterSalesTimeoutStatus["PENDING"] = "pending";
    AfterSalesTimeoutStatus["CANCELLED"] = "cancelled";
    AfterSalesTimeoutStatus["EXECUTED"] = "executed";
    AfterSalesTimeoutStatus["FAILED"] = "failed";
})(AfterSalesTimeoutStatus || (exports.AfterSalesTimeoutStatus = AfterSalesTimeoutStatus = {}));
/**
 * 售后超时自动化任务。
 * delayed job 模式（同 order-timeout-plugin）：SQL JobQueue 忽略 delay 选项，
 * 到期前执行直接跳过，由补偿 ScheduledTask 每 5 分钟扫描 dueAt 过期的 PENDING 任务重新入队；
 * 执行时校验 expectedState 与售后单实际状态一致，否则作废（防止过期动作）。
 */
let AfterSalesTimeoutTask = class AfterSalesTimeoutTask extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.AfterSalesTimeoutTask = AfterSalesTimeoutTask;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AfterSalesTimeoutTask.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesTimeoutTask.prototype, "requestId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], AfterSalesTimeoutTask.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AfterSalesTimeoutTask.prototype, "expectedState", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], AfterSalesTimeoutTask.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: AfterSalesTimeoutStatus.PENDING }),
    __metadata("design:type", String)
], AfterSalesTimeoutTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AfterSalesTimeoutTask.prototype, "attempt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AfterSalesTimeoutTask.prototype, "maxAttempt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AfterSalesTimeoutTask.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AfterSalesTimeoutTask.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], AfterSalesTimeoutTask.prototype, "executedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Channel),
    __metadata("design:type", core_1.Channel)
], AfterSalesTimeoutTask.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], AfterSalesTimeoutTask.prototype, "channels", void 0);
exports.AfterSalesTimeoutTask = AfterSalesTimeoutTask = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)(['status', 'dueAt']),
    __metadata("design:paramtypes", [Object])
], AfterSalesTimeoutTask);
//# sourceMappingURL=after-sales-timeout.entity.js.map