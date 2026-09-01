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
exports.CouponTemplate = void 0;
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
/**
 * 多语言文本的 DB 列转换：DB 内始终以字符串落库（纯字符串原样存；对象/JSON 字符串存
 * 序列化结果），读写时原样保留，使实体上的 `name`/`description` 既可能是纯字符串
 * （历史数据），也可能是 `LocalizedText` 对象（多语言），而无需迁移列类型。
 */
const localizedTextColumn = {
    to: (value) => value == null ? value : typeof value === 'string' ? value : JSON.stringify(value),
    from: (value) => value,
};
/**
 * 券模板：后台可配置的券规则。
 */
let CouponTemplate = class CouponTemplate extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.CouponTemplate = CouponTemplate;
__decorate([
    (0, typeorm_1.Column)('text', { nullable: false, transformer: localizedTextColumn }),
    __metadata("design:type", Object)
], CouponTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true, transformer: localizedTextColumn }),
    __metadata("design:type", Object)
], CouponTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], CouponTemplate.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "discountValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "minSpend", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponTemplate.prototype, "startsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CouponTemplate.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "totalCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "claimedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "pointsPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "perUserLimit", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { default: 'ALL' }),
    __metadata("design:type", String)
], CouponTemplate.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "variantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], CouponTemplate.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { nullable: true }),
    __metadata("design:type", Number)
], CouponTemplate.prototype, "shopId", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => core_1.Channel),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], CouponTemplate.prototype, "channels", void 0);
exports.CouponTemplate = CouponTemplate = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], CouponTemplate);
//# sourceMappingURL=coupon-template.entity.js.map