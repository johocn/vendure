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
exports.RentalPlan = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 租赁计划（variant 级配置）。
 * - depositAmount：押金（security_deposit 损失填补语义，不适用定金 20% 上限——设计 §3/§10）
 * - rentAmount / rentUnit：单位租金（分）
 * - prepaidOrPostpaid：prepaid = 租金下单时一次付清（rentAmount × periods）；postpaid = 按周期后付
 * - buyoutPrice：买断价快照基准（null = 未定价；实际买断款 = max(0, buyoutPrice - 已付租金)）
 * - 期次金额在 startRental 时按本计划快照生成，改配置不影响已生成订单
 */
let RentalPlan = class RentalPlan extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.RentalPlan = RentalPlan;
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], RentalPlan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], RentalPlan.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], RentalPlan.prototype, "depositAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], RentalPlan.prototype, "rentAmount", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'month' }),
    __metadata("design:type", String)
], RentalPlan.prototype, "rentUnit", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'prepaid' }),
    __metadata("design:type", String)
], RentalPlan.prototype, "prepaidOrPostpaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], RentalPlan.prototype, "buyoutPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RentalPlan.prototype, "allowBuyout", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RentalPlan.prototype, "allowCod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RentalPlan.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], RentalPlan.prototype, "channels", void 0);
exports.RentalPlan = RentalPlan = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], RentalPlan);
