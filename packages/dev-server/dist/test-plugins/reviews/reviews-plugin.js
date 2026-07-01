"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsPlugin = void 0;
const core_1 = require("@vendure/core");
const api_extensions_1 = require("./api/api-extensions");
const product_entity_resolver_1 = require("./api/product-entity.resolver");
const product_review_admin_resolver_1 = require("./api/product-review-admin.resolver");
const product_review_entity_resolver_1 = require("./api/product-review-entity.resolver");
const product_review_shop_resolver_1 = require("./api/product-review-shop.resolver");
const product_review_translation_entity_1 = require("./entities/product-review-translation.entity");
const product_review_entity_1 = require("./entities/product-review.entity");
let ReviewsPlugin = class ReviewsPlugin {
};
exports.ReviewsPlugin = ReviewsPlugin;
exports.ReviewsPlugin = ReviewsPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [product_review_entity_1.ProductReview, product_review_translation_entity_1.ProductReviewTranslation],
        adminApiExtensions: {
            schema: api_extensions_1.adminApiExtensions,
            resolvers: [product_entity_resolver_1.ProductEntityResolver, product_review_admin_resolver_1.ProductReviewAdminResolver, product_review_entity_resolver_1.ProductReviewEntityResolver],
        },
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [product_entity_resolver_1.ProductEntityResolver, product_review_shop_resolver_1.ProductReviewShopResolver, product_review_entity_resolver_1.ProductReviewEntityResolver],
        },
        configuration: config => {
            config.customFields.Product.push({
                name: 'reviews',
                type: 'relation',
                list: true,
                entity: product_review_entity_1.ProductReview,
                inverseSide: (review) => review.product,
                ui: { component: 'review-multi-select-with-create' },
            });
            return config;
        },
        dashboard: './dashboard/index.tsx',
    })
], ReviewsPlugin);
