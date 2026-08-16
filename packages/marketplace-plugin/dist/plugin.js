"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MarketplacePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplacePlugin = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const custom_fields_1 = require("./custom-fields");
const marketplace_service_1 = require("./marketplace.service");
const marketplace_seller_service_1 = require("./marketplace-seller-service");
const api_extensions_1 = require("./api/api-extensions");
const shop_resolver_1 = require("./api/shop.resolver");
const mv_shipping_eligibility_checker_1 = require("./config/mv-shipping-eligibility-checker");
const marketplace_seller_strategy_1 = require("./marketplace-seller.strategy");
const marketplace_order_process_1 = require("./marketplace-order-process");
let MarketplacePlugin = MarketplacePlugin_1 = class MarketplacePlugin {
    static init(options) {
        MarketplacePlugin_1.options = options;
        return MarketplacePlugin_1;
    }
};
exports.MarketplacePlugin = MarketplacePlugin;
exports.MarketplacePlugin = MarketplacePlugin = MarketplacePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        configuration: config => {
            config.customFields.Product = [
                ...(config.customFields.Product || []),
                ...custom_fields_1.marketplaceCustomFields.Product,
            ];
            config.customFields.Order = [
                ...(config.customFields.Order || []),
                ...custom_fields_1.marketplaceCustomFields.Order,
            ];
            config.customFields.Channel = [
                ...(config.customFields.Channel || []),
                ...custom_fields_1.marketplaceCustomFields.Channel,
            ];
            config.customFields.Seller = [
                ...(config.customFields.Seller || []),
                ...custom_fields_1.marketplaceCustomFields.Seller,
            ];
            config.shippingOptions.shippingEligibilityCheckers.push(mv_shipping_eligibility_checker_1.multivendorShippingEligibilityChecker);
            const customDefaultOrderProcess = (0, core_1.configureDefaultOrderProcess)({ checkFulfillmentStates: false });
            config.orderOptions.process = [customDefaultOrderProcess, marketplace_order_process_1.marketplaceOrderProcess];
            config.orderOptions.orderSellerStrategy = new marketplace_seller_strategy_1.MarketplaceSellerStrategy();
            config.catalogOptions.productVariantPriceUpdateStrategy =
                new core_1.DefaultProductVariantPriceUpdateStrategy({ syncPricesAcrossChannels: true });
            return config;
        },
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [shop_resolver_1.ShopResolver],
        },
        providers: [
            marketplace_service_1.MarketplaceService,
            marketplace_seller_service_1.MarketplaceSellerService,
            { provide: constants_1.MARKETPLACE_PLUGIN_OPTIONS, useFactory: () => MarketplacePlugin.options },
        ],
    })
], MarketplacePlugin);
