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
exports.ShopMemberPriceResolver = exports.ProductMemberPrice = void 0;
const common_1 = require("@nestjs/common");
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const member_price_rule_service_1 = require("../services/member-price-rule.service");
/**
 * C 端商品会员价展示结果（只读展示，不参与下单计价）。
 * - applied: 是否命中会员价规则（discountPercent < 100）
 * - discountPercent: 命中时的折扣（95 = 95 折），未命中为 null
 */
class ProductMemberPrice {
    constructor() {
        this.discountPercent = null;
    }
}
exports.ProductMemberPrice = ProductMemberPrice;
/**
 * Shop API：当前登录会员在指定商品上的会员价标签查询。
 * - 未登录 / 无顾客档案 / 等级无效 → 返回空数组
 * - 商品不存在 / 未配置规则 / 未命中 → applied: false
 * 纯查询，不改价格链路（下单合计仍走既有订单级促销）。
 */
let ShopMemberPriceResolver = class ShopMemberPriceResolver {
    constructor(connection, customerService, ruleService) {
        this.connection = connection;
        this.customerService = customerService;
        this.ruleService = ruleService;
    }
    async myMemberPrice(ctx, productIds) {
        var _a, _b;
        if (!ctx.activeUserId || productIds.length === 0)
            return [];
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer)
            return [];
        // 与 MemberPriceCalculator 一致：memberLevel 缺省按 1 档
        const memberLevel = (_b = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.memberLevel) !== null && _b !== void 0 ? _b : 1;
        if (!memberLevel || memberLevel < 1)
            return [];
        const ids = productIds
            .map(id => parseInt(String(id), 10))
            .filter(v => Number.isFinite(v));
        if (ids.length === 0)
            return [];
        const products = await this.connection.getRepository(core_1.Product).find({
            where: { id: (0, typeorm_2.In)(ids) },
            relations: ['variants', 'variants.collections'],
        });
        const byId = new Map(products.map(p => [Number(p.id), p]));
        const out = [];
        for (const rawId of productIds) {
            const numId = parseInt(String(rawId), 10);
            const product = Number.isFinite(numId) ? byId.get(numId) : undefined;
            if (!product) {
                out.push({ productId: String(rawId), applied: false, discountPercent: null });
                continue;
            }
            const categoryId = this.resolveProductCategoryId(product);
            const rule = await this.ruleService.findEffectiveRule(ctx, memberLevel, categoryId);
            const applied = !!rule && rule.discountPercent < 100;
            out.push({
                productId: String(rawId),
                applied,
                discountPercent: applied ? rule.discountPercent : null,
            });
        }
        return out;
    }
    /**
     * 解析商品主分类：与 MemberPriceCalculator（variant.collections 第一个）保持一致，
     * 商品级取第一个 variant 的第一个 Collection（按 id 排序保证确定性）。
     */
    resolveProductCategoryId(product) {
        var _a, _b;
        const variants = [...((_a = product.variants) !== null && _a !== void 0 ? _a : [])].sort((a, b) => Number(a.id) - Number(b.id));
        for (const variant of variants) {
            const collections = [...((_b = variant.collections) !== null && _b !== void 0 ? _b : [])].sort((a, b) => Number(a.id) - Number(b.id));
            if (collections.length > 0)
                return Number(collections[0].id);
        }
        return null;
    }
};
exports.ShopMemberPriceResolver = ShopMemberPriceResolver;
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('productIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], ShopMemberPriceResolver.prototype, "myMemberPrice", null);
exports.ShopMemberPriceResolver = ShopMemberPriceResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __param(1, (0, common_1.Inject)(core_1.CustomerService)),
    __param(2, (0, common_1.Inject)(member_price_rule_service_1.MemberPriceRuleService)),
    __metadata("design:paramtypes", [typeorm_2.Connection,
        core_1.CustomerService,
        member_price_rule_service_1.MemberPriceRuleService])
], ShopMemberPriceResolver);
//# sourceMappingURL=shop-member-price.resolver.js.map