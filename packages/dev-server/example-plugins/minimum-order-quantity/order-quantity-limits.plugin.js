"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderQuantityLimitsPlugin = exports.MinMaxOrderInterceptor = void 0;
const core_1 = require("@vendure/core");
/**
 * This OrderInterceptor enforces minimum and maximum order quantities on ProductVariants.
 */
class MinMaxOrderInterceptor {
    init(injector) {
        this.entityHydrator = injector.get(core_1.EntityHydrator);
        this.translatorService = injector.get(core_1.TranslatorService);
    }
    willAddItemToOrder(ctx, order, input) {
        var _a, _b;
        const { productVariant, quantity } = input;
        const min = (_a = productVariant.customFields) === null || _a === void 0 ? void 0 : _a.minOrderQuantity;
        const max = (_b = productVariant.customFields) === null || _b === void 0 ? void 0 : _b.maxOrderQuantity;
        if (min && quantity < min) {
            return this.minErrorMessage(ctx, productVariant, min);
        }
        if (max && quantity > max) {
            return this.maxErrorMessage(ctx, productVariant, max);
        }
    }
    willAdjustOrderLine(ctx, order, input) {
        var _a, _b;
        const { orderLine, quantity } = input;
        const min = (_a = orderLine.productVariant.customFields) === null || _a === void 0 ? void 0 : _a.minOrderQuantity;
        const max = (_b = orderLine.productVariant.customFields) === null || _b === void 0 ? void 0 : _b.maxOrderQuantity;
        if (min && quantity < min) {
            return this.minErrorMessage(ctx, orderLine.productVariant, min);
        }
        if (max && quantity > max) {
            return this.maxErrorMessage(ctx, orderLine.productVariant, max);
        }
    }
    async minErrorMessage(ctx, variant, min) {
        const variantName = await this.getTranslatedVariantName(ctx, variant);
        return `Minimum order quantity for "${variantName}" is ${min}`;
    }
    async maxErrorMessage(ctx, variant, max) {
        const variantName = await this.getTranslatedVariantName(ctx, variant);
        return `Maximum order quantity for "${variantName}" is ${max}`;
    }
    async getTranslatedVariantName(ctx, variant) {
        await this.entityHydrator.hydrate(ctx, variant, { relations: ['translations'] });
        const translated = this.translatorService.translate(variant, ctx);
        return translated.name;
    }
}
exports.MinMaxOrderInterceptor = MinMaxOrderInterceptor;
/**
 * This plugin enforces minimum and maximum order quantities on ProductVariants.
 * It adds two new custom fields to ProductVariant:
 * - minOrderQuantity
 * - maxOrderQuantity
 *
 * It also adds an OrderInterceptor which enforces these limits.
 */
let OrderQuantityLimitsPlugin = class OrderQuantityLimitsPlugin {
};
exports.OrderQuantityLimitsPlugin = OrderQuantityLimitsPlugin;
exports.OrderQuantityLimitsPlugin = OrderQuantityLimitsPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        configuration: config => {
            config.customFields.ProductVariant.push({
                type: 'int',
                min: 0,
                name: 'minOrderQuantity',
                label: [{ languageCode: core_1.LanguageCode.en, value: 'Minimum order quantity' }],
                nullable: true,
            });
            config.customFields.ProductVariant.push({
                type: 'int',
                min: 0,
                name: 'maxOrderQuantity',
                label: [{ languageCode: core_1.LanguageCode.en, value: 'Maximum order quantity' }],
                nullable: true,
            });
            config.orderOptions.orderInterceptors.push(new MinMaxOrderInterceptor());
            return config;
        },
    })
], OrderQuantityLimitsPlugin);
//# sourceMappingURL=order-quantity-limits.plugin.js.map