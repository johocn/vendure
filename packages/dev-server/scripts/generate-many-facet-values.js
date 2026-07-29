"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const core_1 = require("@vendure/core");
const dev_config_1 = require("../dev-config");
const FACET_VALUE_COUNT = 1500;
generateManyFacetValues()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
// Used for testing scenarios where there are many channels
// such as https://github.com/vendurehq/vendure/issues/2233
async function generateManyFacetValues() {
    const { app } = await (0, core_1.bootstrapWorker)(dev_config_1.devConfig);
    const requestContextService = app.get(core_1.RequestContextService);
    const channelService = app.get(core_1.ChannelService);
    const facetService = app.get(core_1.FacetService);
    const facetValueService = app.get(core_1.FacetValueService);
    const ctxAdmin = await requestContextService.create({
        apiType: 'admin',
    });
    const facet = await facetService.create(ctxAdmin, {
        code: 'color',
        translations: [{ languageCode: core_1.LanguageCode.en, name: 'Color' }],
        isPrivate: false,
        values: [],
    });
    for (let i = FACET_VALUE_COUNT; i > 0; i--) {
        const facetValue = await facetValueService.create(ctxAdmin, facet, {
            code: `color-${i}`,
            translations: [{ languageCode: core_1.LanguageCode.en, name: `Color ${i}` }],
            facetId: facet.id,
        });
        console.log(`Created channel ${facetValue.code}`);
    }
}
//# sourceMappingURL=generate-many-facet-values.js.map