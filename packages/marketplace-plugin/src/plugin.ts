import { VendurePlugin } from '@vendure/core';
import { PluginCommonModule } from '@vendure/core';
import { MARKETPLACE_PLUGIN_OPTIONS } from './constants';
import { MarketplacePluginOptions } from './types';
import { marketplaceCustomFields } from './custom-fields';
import { MarketplaceService } from './marketplace.service';

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
        return config;
    },
    providers: [
        MarketplaceService,
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