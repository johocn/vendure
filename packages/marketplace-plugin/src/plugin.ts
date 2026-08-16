import { DocumentNode } from 'graphql';
import {
    configureDefaultOrderProcess,
    DefaultProductVariantPriceUpdateStrategy,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';
import { MARKETPLACE_PLUGIN_OPTIONS } from './constants';
import { MarketplacePluginOptions } from './types';
import { marketplaceCustomFields } from './custom-fields';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceSellerService } from './marketplace-seller-service';
import { shopApiExtensions } from './api/api-extensions';
import { ShopResolver } from './api/shop.resolver';
import { multivendorShippingEligibilityChecker } from './config/mv-shipping-eligibility-checker';
import { MarketplaceSellerStrategy } from './marketplace-seller.strategy';
import { MarketplaceStockLocationStrategy } from './marketplace-stock.strategy';
import { marketplaceOrderProcess } from './marketplace-order-process';
import { paymentApiExtensions } from './payment/api-extensions';
import { DirectPaymentResolver } from './payment/direct-payment.resolver';
import { adminApiExtensions } from './api/admin.api-extensions';
import { AdminMarketplaceResolver } from './api/admin.resolver';

@VendurePlugin({
    imports: [PluginCommonModule],
    configuration: config => {
        config.customFields.Product = [
            ...(config.customFields.Product || []),
            ...marketplaceCustomFields.Product!,
        ];
        config.customFields.Order = [
            ...(config.customFields.Order || []),
            ...marketplaceCustomFields.Order!,
        ];
        config.customFields.Channel = [
            ...(config.customFields.Channel || []),
            ...marketplaceCustomFields.Channel!,
        ];
        config.customFields.Seller = [
            ...(config.customFields.Seller || []),
            ...marketplaceCustomFields.Seller!,
        ];
        config.shippingOptions.shippingEligibilityCheckers.push(multivendorShippingEligibilityChecker);

        const customDefaultOrderProcess = configureDefaultOrderProcess({ checkFulfillmentStates: false });
        config.orderOptions.process = [customDefaultOrderProcess, marketplaceOrderProcess];
        config.orderOptions.orderSellerStrategy = new MarketplaceSellerStrategy();
        config.catalogOptions.productVariantPriceUpdateStrategy =
            new DefaultProductVariantPriceUpdateStrategy({ syncPricesAcrossChannels: true });
        config.catalogOptions.stockLocationStrategy = new MarketplaceStockLocationStrategy();
        return config;
    },
    shopApiExtensions: {
        schema: (shopApiExtensions + paymentApiExtensions) as unknown as DocumentNode,
        resolvers: [ShopResolver, DirectPaymentResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions as unknown as DocumentNode,
        resolvers: [AdminMarketplaceResolver],
    },
    providers: [
        MarketplaceService,
        MarketplaceSellerService,
        { provide: MARKETPLACE_PLUGIN_OPTIONS, useFactory: () => MarketplacePlugin.options },
    ],
})
export class MarketplacePlugin {
    static options: MarketplacePluginOptions;

    static init(options: MarketplacePluginOptions) {
        MarketplacePlugin.options = options;
        return MarketplacePlugin;
    }
}