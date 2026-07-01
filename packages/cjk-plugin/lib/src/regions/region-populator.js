"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegionPopulator = void 0;
const core_1 = require("@vendure/core");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const constants_1 = require("../constants");
class RegionPopulator {
    async populate(injector, ctx, countries) {
        const countryService = injector.get(core_1.CountryService);
        const zoneService = injector.get(core_1.ZoneService);
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
    async populateChina(ctx, countryService, zoneService) {
        try {
            const zone = await zoneService.create(ctx, { name: '中国' });
            await countryService.create(ctx, {
                code: 'CN',
                enabled: true,
                translations: [{ languageCode: generated_types_1.LanguageCode.zh_Hans, name: '中国' }],
            });
            core_1.Logger.info('Created China country and zone', constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.warn(`Could not create China: ${e.message}`, constants_1.loggerCtx);
        }
    }
    async populateJapan(ctx, countryService, zoneService) {
        try {
            const zone = await zoneService.create(ctx, { name: '日本' });
            await countryService.create(ctx, {
                code: 'JP',
                enabled: true,
                translations: [{ languageCode: generated_types_1.LanguageCode.ja, name: '日本' }],
            });
            core_1.Logger.info('Created Japan country and zone', constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.warn(`Could not create Japan: ${e.message}`, constants_1.loggerCtx);
        }
    }
    async populateKorea(ctx, countryService, zoneService) {
        try {
            const zone = await zoneService.create(ctx, { name: '韩国' });
            await countryService.create(ctx, {
                code: 'KR',
                enabled: true,
                translations: [{ languageCode: generated_types_1.LanguageCode.ko, name: '한국' }],
            });
            core_1.Logger.info('Created Korea country and zone', constants_1.loggerCtx);
        }
        catch (e) {
            core_1.Logger.warn(`Could not create Korea: ${e.message}`, constants_1.loggerCtx);
        }
    }
}
exports.RegionPopulator = RegionPopulator;
//# sourceMappingURL=region-populator.js.map