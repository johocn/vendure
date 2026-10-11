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
exports.DiyMaterial = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * DIY 素材：单表两层（app=null 平台库 / 非空=租户库），层级唯一开关。
 * 金额分（整数）、长度 mm（double）。
 * 唯一键 (app, code) 在服务层校验（postgres 唯一索引对 NULL 视为互异，
 * 平台行无法用 DB 约束保唯一）；此处复合索引用于查询性能。
 */
let DiyMaterial = class DiyMaterial extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.DiyMaterial = DiyMaterial;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "app", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 64 }),
    __metadata("design:type", String)
], DiyMaterial.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DiyMaterial.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], DiyMaterial.prototype, "shape", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "diameter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "axialLength", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "holeSize", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "attrs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "render", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], DiyMaterial.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'piece' }),
    __metadata("design:type", String)
], DiyMaterial.prototype, "priceUnit", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 3, default: 'CNY' }),
    __metadata("design:type", String)
], DiyMaterial.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], DiyMaterial.prototype, "stock", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], DiyMaterial.prototype, "sourceMaterialId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DiyMaterial.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], DiyMaterial.prototype, "sortOrder", void 0);
exports.DiyMaterial = DiyMaterial = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Index)('idx_diy_material_app_code', ['app', 'code']),
    __metadata("design:paramtypes", [Object])
], DiyMaterial);
//# sourceMappingURL=diy-material.entity.js.map