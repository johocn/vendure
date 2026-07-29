"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productDuplicator = void 0;
const generated_types_1 = require("@vendure/common/lib/generated-types");
const typeorm_1 = require("typeorm");
const common_1 = require("../../../common");
const transactional_connection_1 = require("../../../connection/transactional-connection");
const product_variant_entity_1 = require("../../../entity/product-variant/product-variant.entity");
const product_entity_1 = require("../../../entity/product/product.entity");
const product_variant_service_1 = require("../../../service/services/product-variant.service");
const product_service_1 = require("../../../service/services/product.service");
const entity_duplicator_1 = require("../entity-duplicator");
let connection;
let productService;
let productVariantService;
/**
 * @description
 * Duplicates a Product and its associated ProductVariants.
 */
exports.productDuplicator = new entity_duplicator_1.EntityDuplicator({
    code: 'product-duplicator',
    description: [
        {
            languageCode: generated_types_1.LanguageCode.en,
            value: 'Default duplicator for Products',
        },
    ],
    requiresPermission: [generated_types_1.Permission.CreateProduct, generated_types_1.Permission.CreateCatalog],
    forEntities: ['Product'],
    args: {
        includeVariants: {
            type: 'boolean',
            defaultValue: true,
            label: [{ languageCode: generated_types_1.LanguageCode.en, value: 'Include variants' }],
        },
    },
    init(injector) {
        connection = injector.get(transactional_connection_1.TransactionalConnection);
        productService = injector.get(product_service_1.ProductService);
        productVariantService = injector.get(product_variant_service_1.ProductVariantService);
    },
    async duplicate({ ctx, id, args }) {
        var _a, _b;
        const product = await connection.getEntityOrThrow(ctx, product_entity_1.Product, id, {
            relations: {
                featuredAsset: true,
                assets: true,
                channels: true,
                facetValues: {
                    facet: true,
                },
                optionGroups: {
                    options: true,
                },
            },
        });
        const translations = product.translations.map(translation => {
            return {
                name: translation.name + ' (copy)',
                slug: translation.slug + '-copy',
                description: translation.description,
                languageCode: translation.languageCode,
                customFields: translation.customFields,
            };
        });
        const productInput = {
            featuredAssetId: (_a = product.featuredAsset) === null || _a === void 0 ? void 0 : _a.id,
            enabled: false,
            assetIds: product.assets.map(value => value.assetId),
            facetValueIds: product.facetValues.map(value => value.id),
            translations,
            customFields: product.customFields,
        };
        const duplicatedProduct = await productService.create(ctx, productInput);
        if (args.includeVariants) {
            const productVariants = await connection.getRepository(ctx, product_variant_entity_1.ProductVariant).find({
                where: {
                    productId: id,
                    deletedAt: (0, typeorm_1.IsNull)(),
                },
                relations: {
                    options: {
                        group: true,
                    },
                    assets: true,
                    featuredAsset: true,
                    stockLevels: true,
                    facetValues: true,
                    productVariantPrices: true,
                    taxCategory: true,
                },
            });
            if ((_b = product.optionGroups) === null || _b === void 0 ? void 0 : _b.length) {
                for (const optionGroup of product.optionGroups) {
                    await productService.addOptionGroupToProduct(ctx, duplicatedProduct.id, optionGroup.id);
                }
            }
            const variantInput = productVariants.map((variant, i) => {
                var _a, _b, _c, _d, _e;
                const optionIds = variant.options.map(o => o.id);
                const price = (_b = (_a = variant.productVariantPrices.find(p => (0, common_1.idsAreEqual)(p.channelId, ctx.channelId))) === null || _a === void 0 ? void 0 : _a.price) !== null && _b !== void 0 ? _b : (_c = variant.productVariantPrices[0]) === null || _c === void 0 ? void 0 : _c.price;
                return {
                    productId: duplicatedProduct.id,
                    price: price !== null && price !== void 0 ? price : variant.price,
                    sku: `${variant.sku}-copy`,
                    stockOnHand: 1,
                    featuredAssetId: (_d = variant.featuredAsset) === null || _d === void 0 ? void 0 : _d.id,
                    taxCategoryId: (_e = variant.taxCategory) === null || _e === void 0 ? void 0 : _e.id,
                    useGlobalOutOfStockThreshold: variant.useGlobalOutOfStockThreshold,
                    trackInventory: variant.trackInventory,
                    assetIds: variant.assets.map(value => value.assetId),
                    translations: variant.translations.map(translation => {
                        return {
                            languageCode: translation.languageCode,
                            name: translation.name,
                            customFields: translation.customFields,
                        };
                    }),
                    optionIds,
                    facetValueIds: variant.facetValues.map(value => value.id),
                    stockLevels: variant.stockLevels.map(stockLevel => ({
                        stockLocationId: stockLevel.stockLocationId,
                        stockOnHand: stockLevel.stockOnHand,
                    })),
                    customFields: variant.customFields,
                };
            });
            const duplicatedProductVariants = await productVariantService.create(ctx, variantInput);
            duplicatedProduct.variants = duplicatedProductVariants;
        }
        return duplicatedProduct;
    },
});
//# sourceMappingURL=product-duplicator.js.map