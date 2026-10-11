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
exports.DiyTemplate = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/** DIY 玩法模板：config=slots+params+constraints+presentation；calculatorKey=null 兜底内置 sum */
let DiyTemplate = class DiyTemplate extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.DiyTemplate = DiyTemplate;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "app", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 64 }),
    __metadata("design:type", String)
], DiyTemplate.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "thumb", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { nullable: true }),
    __metadata("design:type", Object)
], DiyTemplate.prototype, "calculatorKey", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'draft' }),
    __metadata("design:type", String)
], DiyTemplate.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], DiyTemplate.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], DiyTemplate.prototype, "sortOrder", void 0);
exports.DiyTemplate = DiyTemplate = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_diy_template_app_code', ['app', 'code']),
    __metadata("design:paramtypes", [Object])
], DiyTemplate);
//# sourceMappingURL=diy-template.entity.js.map