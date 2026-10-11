import { Injectable, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPluginOptions } from './types';

@Injectable()
export class DiyServiceStub {}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [DiyCategory, DiyMaterial, DiyTemplate],
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
