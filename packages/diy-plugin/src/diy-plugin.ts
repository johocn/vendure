import { Injectable, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyPluginOptions } from './types';

@Injectable()
export class DiyServiceStub {}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [],
    providers: [{ provide: PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options }, DiyServiceStub],
    exports: [],
    compatibility: '^3.0.0',
})
export class DiyPlugin {
    private static options: DiyPluginOptions = {};

    static init(options?: DiyPluginOptions): Type<DiyPlugin> {
        DiyPlugin.options = options ?? {};
        return DiyPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('DiyPlugin initialized (skeleton)', loggerCtx);
    }
}
