import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { loggerCtx, MEILI_PLUGIN_OPTIONS } from './constants';
import { MeiliService } from './meili.service';
import { MeiliPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: MEILI_PLUGIN_OPTIONS, useFactory: () => MeiliSearchPlugin.options },
        MeiliService,
    ],
    exports: [MeiliService],
    compatibility: '^3.0.0',
})
export class MeiliSearchPlugin {
    static options: MeiliPluginOptions;

    constructor(
        @Inject(MEILI_PLUGIN_OPTIONS) private options: MeiliPluginOptions,
        private meiliService: MeiliService,
    ) {}

    static init(options: MeiliPluginOptions): Type<MeiliSearchPlugin> {
        MeiliSearchPlugin.options = options;
        return MeiliSearchPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        try {
            await this.meiliService.ensureIndexes();
            Logger.info('MeiliSearchPlugin initialized', loggerCtx);
        } catch (e) {
            // Meili 不可用不阻塞 Vendure 启动，降级为日志（后续同步请求仍会暴露问题）
            Logger.error(`MeiliSearchPlugin bootstrap failed: ${String(e)}`, loggerCtx);
        }
    }
}
