import { VendurePlugin } from '@vendure/core';
import { PluginCommonModule } from '@vendure/core';
import { MARKETPLACE_PLUGIN_OPTIONS } from './constants';
import { MarketplacePluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
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