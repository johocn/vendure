import { Inject, MiddlewareConsumer, NestModule, OnApplicationBootstrap, Type } from '@nestjs/common';
import { I18nService, Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ModuleRef } from '@nestjs/core';

import { CJK_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { codPaymentHandler } from './payment/cod-handler';
import { RegionPopulator } from './regions/region-populator';
import { CjkPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [{ provide: CJK_PLUGIN_OPTIONS, useFactory: () => CjkPlugin.options }],
    configuration: config => {
        if (CjkPlugin.options.cod?.enabled) {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                codPaymentHandler,
            ];
        }
        return config;
    },
    compatibility: '^3.0.0',
})
export class CjkPlugin implements OnApplicationBootstrap, NestModule {
    private static options: CjkPluginOptions;

    constructor(
        @Inject(CJK_PLUGIN_OPTIONS) private options: CjkPluginOptions,
        private moduleRef: ModuleRef,
    ) {}

    static init(options: CjkPluginOptions): Type<CjkPlugin> {
        CjkPlugin.options = options;
        return CjkPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        if (this.options.i18n?.enabled !== false) {
            const i18nService = this.moduleRef.get(I18nService);
            const languages = this.options.i18n?.languages || ['zh_Hans', 'zh_Hant', 'ja', 'ko'];
            const translations: Record<string, any> = {
                zh_Hans: await import('./i18n/zh_CN.json'),
                zh_Hant: await import('./i18n/zh_TW.json'),
                ja: await import('./i18n/ja.json'),
                ko: await import('./i18n/ko.json'),
            };
            for (const lang of languages) {
                if (translations[lang]) {
                    i18nService.addTranslation(lang, translations[lang]);
                    Logger.info(`Registered i18n translation for ${lang}`, loggerCtx);
                }
            }
        }

        if (this.options.regions?.enabled !== false) {
            Logger.info('CJK regions module enabled - use RegionPopulator in your server bootstrap to populate countries', loggerCtx);
        }

        if (this.options.cod?.enabled) {
            Logger.info('Cash on Delivery payment module enabled', loggerCtx);
        }
    }

    configure(consumer: MiddlewareConsumer): void {}
}
