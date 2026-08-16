import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { loggerCtx, REDIS_STOCK_PLUGIN_OPTIONS } from './constants';
import { redisStockChannelCustomFields } from './channel-custom-fields';
import { StockPrewarmService } from './stock-prewarm.service';
import { StockReserveService } from './stock-reserve.service';
import { RedisStockPluginOptions } from './types';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: REDIS_STOCK_PLUGIN_OPTIONS, useFactory: () => RedisStockPlugin.options },
        StockReserveService,
        StockPrewarmService,
    ],
    configuration: (config) => {
        config.customFields.Channel = mergeCustomFields(config.customFields.Channel, redisStockChannelCustomFields.Channel);
        return config;
    },
    dashboard: '../dashboard/index.tsx',
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
