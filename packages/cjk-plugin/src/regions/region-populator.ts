import { Injector, Logger, CountryService, RequestContext, ZoneService } from '@vendure/core';
import { LanguageCode } from '@vendure/common/lib/generated-types';

import { loggerCtx } from '../constants';

export class RegionPopulator {
    async populate(injector: Injector, ctx: RequestContext, countries: ('CN' | 'JP' | 'KR')[]): Promise<void> {
        const countryService = injector.get(CountryService);
        const zoneService = injector.get(ZoneService);

        if (countries.includes('CN')) {
            await this.populateChina(ctx, countryService, zoneService);
        }
        if (countries.includes('JP')) {
            await this.populateJapan(ctx, countryService, zoneService);
        }
        if (countries.includes('KR')) {
            await this.populateKorea(ctx, countryService, zoneService);
        }
    }

    private async populateChina(ctx: RequestContext, countryService: CountryService, zoneService: ZoneService): Promise<void> {
        try {
            const zone = await zoneService.create(ctx, { name: '中国' });
            await countryService.create(ctx, {
                code: 'CN',
                enabled: true,
                translations: [{ languageCode: LanguageCode.zh_Hans, name: '中国' }],
            });
            Logger.info('Created China country and zone', loggerCtx);
        } catch (e: any) {
            Logger.warn(`Could not create China: ${e.message}`, loggerCtx);
        }
    }

    private async populateJapan(ctx: RequestContext, countryService: CountryService, zoneService: ZoneService): Promise<void> {
        try {
            const zone = await zoneService.create(ctx, { name: '日本' });
            await countryService.create(ctx, {
                code: 'JP',
                enabled: true,
                translations: [{ languageCode: LanguageCode.ja, name: '日本' }],
            });
            Logger.info('Created Japan country and zone', loggerCtx);
        } catch (e: any) {
            Logger.warn(`Could not create Japan: ${e.message}`, loggerCtx);
        }
    }

    private async populateKorea(ctx: RequestContext, countryService: CountryService, zoneService: ZoneService): Promise<void> {
        try {
            const zone = await zoneService.create(ctx, { name: '韩国' });
            await countryService.create(ctx, {
                code: 'KR',
                enabled: true,
                translations: [{ languageCode: LanguageCode.ko, name: '한국' }],
            });
            Logger.info('Created Korea country and zone', loggerCtx);
        } catch (e: any) {
            Logger.warn(`Could not create Korea: ${e.message}`, loggerCtx);
        }
    }
}
