"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductBundlesPlugin = void 0;
const core_1 = require("@vendure/core");
const path_1 = __importDefault(require("path"));
const api_extensions_1 = require("./api/api-extensions");
const product_bundle_admin_resolver_1 = require("./api/product-bundle-admin.resolver");
const product_bundle_shop_resolver_1 = require("./api/product-bundle-shop.resolver");
const bundle_order_interceptor_1 = require("./config/bundle-order-interceptor");
const constants_1 = require("./constants");
const product_bundle_item_entity_1 = require("./entities/product-bundle-item.entity");
const product_bundle_entity_1 = require("./entities/product-bundle.entity");
const product_bundle_item_service_1 = require("./services/product-bundle-item.service");
const product_bundle_service_1 = require("./services/product-bundle.service");
let ProductBundlesPlugin = class ProductBundlesPlugin {
};
exports.ProductBundlesPlugin = ProductBundlesPlugin;
ProductBundlesPlugin.uiExtensions = {
    id: 'product-bundles',
    extensionPath: path_1.default.join(__dirname, 'ui'),
    routes: [{ route: 'product-bundles', filePath: 'routes.ts' }],
    providers: ['providers.ts'],
};
exports.ProductBundlesPlugin = ProductBundlesPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [product_bundle_entity_1.ProductBundle, product_bundle_item_entity_1.ProductBundleItem],
        configuration: config => {
            config.customFields.OrderLine.push({
                type: 'struct',
                name: 'fromBundle',
                fields: [
                    { name: 'bundleId', type: 'string' },
                    { name: 'bundleName', type: 'string' },
                ],
            });
            config.orderOptions.orderInterceptors.push(new bundle_order_interceptor_1.BundleOrderInterceptor());
            config.authOptions.customPermissions.push(constants_1.productBundlePermission);
            return config;
        },
        providers: [product_bundle_service_1.ProductBundleService, product_bundle_item_service_1.ProductBundleItemService],
        adminApiExtensions: {
            schema: api_extensions_1.adminApiExtensions,
            resolvers: [product_bundle_admin_resolver_1.ProductBundleAdminResolver],
        },
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [product_bundle_shop_resolver_1.ProductBundleShopResolver],
        },
    })
], ProductBundlesPlugin);
//# sourceMappingURL=product-bundles.plugin.js.map