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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponTemplateResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const coupon_template_entity_1 = require("./coupon-template.entity");
const localize_1 = require("./localize");
/**
 * CouponTemplate 输出字段的本地化解析。
 *
 * `name`/`description`（LocalizedText，DB 内可能是纯字符串或 JSON 字符串/对象）按当前会话
 * 语言 `ctx.languageCode` 经 `localizeText()` 求值后输出，保证 GraphQL 端 `name` 即为当前语言文案，
 * 既有纯字符串数据原样透传（向后兼容）。field resolver 在 admin 与 shop 两套 schema 均注册，
 * 一处实现即可覆盖 couponCentre / myCoupons(template) / pointsMallTemplates / couponTemplates 等所有入口。
 */
let CouponTemplateResolver = class CouponTemplateResolver {
    name(template, ctx) {
        return (0, localize_1.localizeText)(template.name, ctx.languageCode, '');
    }
    description(template, ctx) {
        const v = template.description;
        if (v == null) {
            return null;
        }
        return (0, localize_1.localizeText)(v, ctx.languageCode, '') || null;
    }
};
exports.CouponTemplateResolver = CouponTemplateResolver;
__decorate([
    (0, graphql_1.ResolveField)('name'),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [coupon_template_entity_1.CouponTemplate, core_1.RequestContext]),
    __metadata("design:returntype", String)
], CouponTemplateResolver.prototype, "name", null);
__decorate([
    (0, graphql_1.ResolveField)('description'),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [coupon_template_entity_1.CouponTemplate, core_1.RequestContext]),
    __metadata("design:returntype", Object)
], CouponTemplateResolver.prototype, "description", null);
exports.CouponTemplateResolver = CouponTemplateResolver = __decorate([
    (0, graphql_1.Resolver)('CouponTemplate')
], CouponTemplateResolver);
//# sourceMappingURL=coupon-template.resolver.js.map