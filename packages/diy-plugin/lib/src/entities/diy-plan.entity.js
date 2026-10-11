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
exports.DiyPlan = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * DIY 搭配方案（规格 §6.1）：draft / quoted / ordered 三态统一载体。
 * spec 与 bom 均为快照——模板/素材后续改版不影响存量方案；
 * quote/order 环节会以服务端实时价复算并覆盖 bom（quoteRefAmount 记录报价参考价）。
 */
let DiyPlan = class DiyPlan extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.DiyPlan = DiyPlan;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DiyPlan.prototype, "app", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], DiyPlan.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DiyPlan.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], DiyPlan.prototype, "templateVersion", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'draft' }),
    __metadata("design:type", String)
], DiyPlan.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], DiyPlan.prototype, "spec", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], DiyPlan.prototype, "bom", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 16 }),
    __metadata("design:type", String)
], DiyPlan.prototype, "calcVersion", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 32, nullable: true }),
    __metadata("design:type", Object)
], DiyPlan.prototype, "quoteNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], DiyPlan.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], DiyPlan.prototype, "orderLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DiyPlan.prototype, "thumb", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DiyPlan.prototype, "shareImage", void 0);
exports.DiyPlan = DiyPlan = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_diy_plan_app_user', ['app', 'userId']),
    __metadata("design:paramtypes", [Object])
], DiyPlan);
//# sourceMappingURL=diy-plan.entity.js.map