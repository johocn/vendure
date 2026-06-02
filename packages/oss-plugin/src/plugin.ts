import { Inject, Type } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { OSS_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { OssAssetStorageStrategy } from './oss-strategy';
import { OssPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [{ provide: OSS_PLUGIN_OPTIONS, useFactory: () => OssPlugin.options }],
    configuration: config => {
        const strategy = new OssAssetStorageStrategy(OssPlugin.options);
        config.assetOptions.assetStorageStrategy = strategy;
        return config;
    },
    compatibility: '^3.0.0',
})
export class OssPlugin {
    private static options: OssPluginOptions;

    constructor(@Inject(OSS_PLUGIN_OPTIONS) private options: OssPluginOptions) {}

    static init(options: OssPluginOptions): Type<OssPlugin> {
        OssPlugin.options = options;
        return OssPlugin;
    }
}
