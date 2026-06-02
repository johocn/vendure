import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { loggerCtx, REDIS_STOCK_PLUGIN_OPTIONS } from './constants';
import { redisStockChannelCustomFields } from './channel-custom-fields';
import { StockPrewarmService } from './stock-prewarm.service';
import { StockReserveService } from './stock-reserve.service';
import { RedisStockPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: REDIS_STOCK_PLUGIN_OPTIONS, useFactory: () => RedisStockPlugin.options },
        StockReserveService,
        StockPrewarmService,
    ],
    configuration: (config) => {
        const existingChannelFields = config.customFields.Channel ?? [];
        const newChannelFields = redisStockChannelCustomFields.Channel ?? [];
        config.customFields.Channel = [...existingChannelFields, ...newChannelFields];
        return config;
    },
    compatibility: '^3.0.0',
})
export class RedisStockPlugin implements OnApplicationBootstrap {
    private static options: RedisStockPluginOptions = {};

    constructor(
        @Inject(REDIS_STOCK_PLUGIN_OPTIONS) private options: RedisStockPluginOptions,
        private stockReserveService: StockReserveService,
    ) {}

    static init(options?: RedisStockPluginOptions): Type<RedisStockPlugin> {
        RedisStockPlugin.options = options ?? {};
        return RedisStockPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        await this.stockReserveService.init(this.options);
        Logger.info('RedisStockPlugin initialized', loggerCtx);
    }
}
