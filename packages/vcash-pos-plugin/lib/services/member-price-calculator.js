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
exports.MemberPriceCalculator = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@vendure/core");
const typeorm_2 = require("typeorm");
const member_price_rule_service_1 = require("./member-price-rule.service");
/**
 * 会员价计算引擎：
 * 1. 读取 customer.customFields.memberLevel
 * 2. 查 ProductVariant → Product → 主分类（product_product_category 第一个 categoryId）
 * 3. 调 MemberPriceRuleService.findEffectiveRule(level, categoryId) 命中规则
 * 4. 返回 discountPercent 与 applied 标志
 *
 * 设计原则：纯查询计算，不修改 order/orderLine（由调用方应用结果）
 */
let MemberPriceCalculator = class MemberPriceCalculator {
    constructor(connection, transactionalConnection, ruleService) {
        this.connection = connection;
        this.transactionalConnection = transactionalConnection;
        this.ruleService = ruleService;
    }
    /**
     * 计算指定会员 + 商品变体的会员价折扣。
     * 若 customer 为 null / 无 memberLevel / 无匹配规则，返回 discountPercent=100, applied=false。
     */
    async calculate(ctx, customer, variantId) {
        var _a, _b, _c;
        if (!customer)
            return { discountPercent: 100, applied: false, ruleId: null };
        // customer 可能是轻量对象（仅 id）；如果 customFields 缺失则查库
        let memberLevel = (_a = customer.customFields) === null || _a === void 0 ? void 0 : _a.memberLevel;
        if (memberLevel == null) {
            const full = await this.connection.getRepository(core_1.Customer).findOne({
                where: { id: customer.id },
            });
            memberLevel = (_c = (_b = full === null || full === void 0 ? void 0 : full.customFields) === null || _b === void 0 ? void 0 : _b.memberLevel) !== null && _c !== void 0 ? _c : 1;
        }
        if (!memberLevel || memberLevel < 1) {
            return { discountPercent: 100, applied: false, ruleId: null };
        }
        const categoryId = await this.resolveVariantCategoryId(variantId);
        const rule = await this.ruleService.findEffectiveRule(ctx, memberLevel, categoryId);
        if (!rule)
            return { discountPercent: 100, applied: false, ruleId: null };
        return {
            discountPercent: rule.discountPercent,
            applied: rule.discountPercent < 100,
            ruleId: rule.id,
        };
    }
    /**
     * 解析 ProductVariant → 主分类 ID（取 ProductVariant.collections 关联的第一个 Collection）。
     * Vendure 中"分类"由 Collection 实体表达（ProductVariant.collections ManyToMany）。
     * 无 Collection 返回 null（findEffectiveRule 会回退到 global 规则）。
     */
    async resolveVariantCategoryId(variantId) {
        var _a;
        const variant = await this.connection.getRepository(core_1.ProductVariant).findOne({
            where: { id: variantId },
            relations: ['collections'],
        });
        const collections = (_a = variant === null || variant === void 0 ? void 0 : variant.collections) !== null && _a !== void 0 ? _a : [];
        return collections.length > 0 ? Number(collections[0].id) : null;
    }
};
exports.MemberPriceCalculator = MemberPriceCalculator;
exports.MemberPriceCalculator = MemberPriceCalculator = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __param(1, (0, common_1.Inject)(core_1.TransactionalConnection)),
    __param(2, (0, common_1.Inject)(member_price_rule_service_1.MemberPriceRuleService)),
    __metadata("design:paramtypes", [typeorm_2.Connection,
        core_1.TransactionalConnection,
        member_price_rule_service_1.MemberPriceRuleService])
], MemberPriceCalculator);
//# sourceMappingURL=member-price-calculator.js.map