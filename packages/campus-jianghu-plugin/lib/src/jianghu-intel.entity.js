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
exports.JianghuIntel = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * 情报集市条目（方向二）。仅承载公开信息；sourceNote 必填，合规留痕。
 * 审核通过 (APPROVED) 才上架；违规内容 REJECTED。
 */
let JianghuIntel = class JianghuIntel extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.JianghuIntel = JianghuIntel;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuIntel.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], JianghuIntel.prototype, "campusCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuIntel.prototype, "summary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], JianghuIntel.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], JianghuIntel.prototype, "sourceNote", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 5 }),
    __metadata("design:type", Number)
], JianghuIntel.prototype, "priceIntel", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], JianghuIntel.prototype, "viewCount", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { nullable: true }),
    __metadata("design:type", Object)
], JianghuIntel.prototype, "authorCustomerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'PENDING' }),
    __metadata("design:type", String)
], JianghuIntel.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => core_1.Customer),
    __metadata("design:type", core_1.Customer)
], JianghuIntel.prototype, "author", void 0);
exports.JianghuIntel = JianghuIntel = __decorate([
    (0, typeorm_1.Entity)('jianghu_intel'),
    (0, typeorm_1.Index)(['campusCode']),
    (0, typeorm_1.Index)(['status']),
    __metadata("design:paramtypes", [Object])
], JianghuIntel);
//# sourceMappingURL=jianghu-intel.entity.js.map