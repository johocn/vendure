import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { LOGISTICS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { LogisticsPluginOptions } from './types';
import { logisticsFulfillmentCustomFields } from './fulfillment-custom-fields';
import { logisticsChannelCustomFields } from './channel-custom-fields';
import { ChannelStockAllocationStrategy } from './channel-stock-allocation-strategy';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: LOGISTICS_PLUGIN_OPTIONS, useFactory: () => LogisticsPlugin.options },
    ],
    configuration: (config) => {
        config.customFields.Fulfillment = [
            ...(config.customFields.Fulfillment ?? []),
            ...logisticsFulfillmentCustomFields.Fulfillment!,
        ];
        config.customFields.Channel = [
            ...(config.customFields.Channel ?? []),
            ...logisticsChannelCustomFields.Channel!,
        ];
        config.orderOptions.stockAllocationStrategy = new ChannelStockAllocationStrategy();
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class LogisticsPlugin {
    private static options: LogisticsPluginOptions = {};

    constructor(@Inject(LOGISTICS_PLUGIN_OPTIONS) private options: LogisticsPluginOptions) {}

    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin> {
        LogisticsPlugin.options = options ?? {};
        return LogisticsPlugin;
    }
}
