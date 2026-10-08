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
exports.InstallmentPlan = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 分期计划（variant 级配置）。
 * - downPaymentRatio：首付比例（整数百分比 0-90；0 = 无首付）
 * - periods：分期期数（1-36）
 * - intervalCount：间隔数（0 = 立即应付，>0 = 每隔 N 个 unit 一期）
 * - feeRule：手续费规则（仅登记，本次不计费——设计 §11 边界）
 */
let InstallmentPlan = class InstallmentPlan extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.InstallmentPlan = InstallmentPlan;
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], InstallmentPlan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], InstallmentPlan.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], InstallmentPlan.prototype, "downPaymentRatio", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 3 }),
    __metadata("design:type", Number)
], InstallmentPlan.prototype, "periods", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'month' }),
    __metadata("design:type", String)
], InstallmentPlan.prototype, "intervalUnit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], InstallmentPlan.prototype, "intervalCount", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], InstallmentPlan.prototype, "feeRule", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], InstallmentPlan.prototype, "allowCod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], InstallmentPlan.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], InstallmentPlan.prototype, "channels", void 0);
exports.InstallmentPlan = InstallmentPlan = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], InstallmentPlan);
