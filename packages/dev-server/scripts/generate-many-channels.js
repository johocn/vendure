"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const core_1 = require("@vendure/core");
const dev_config_1 = require("../dev-config");
const CHANNEL_COUNT = 1001;
generateManyChannels()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
// Used for testing scenarios where there are many channels
// such as https://github.com/vendurehq/vendure/issues/2233
async function generateManyChannels() {
    const { app } = await (0, core_1.bootstrapWorker)(dev_config_1.devConfig);
    const requestContextService = app.get(core_1.RequestContextService);
    const channelService = app.get(core_1.ChannelService);
    const roleService = app.get(core_1.RoleService);
    const ctxAdmin = await requestContextService.create({
        apiType: 'admin',
    });
    const superAdminRole = await roleService.getSuperAdminRole(ctxAdmin);
    const customerRole = await roleService.getCustomerRole(ctxAdmin);
    for (let i = CHANNEL_COUNT; i > 0; i--) {
        const channel = await channelService.create(ctxAdmin, {
            code: `channel-test-${i}`,
            token: `channel--test-${i}`,
            defaultLanguageCode: core_1.LanguageCode.en,
            availableLanguageCodes: [core_1.LanguageCode.en],
            pricesIncludeTax: true,
            defaultCurrencyCode: core_1.CurrencyCode.USD,
            availableCurrencyCodes: [core_1.CurrencyCode.USD],
            sellerId: 1,
            defaultTaxZoneId: 1,
            defaultShippingZoneId: 1,
        });
        if ((0, core_1.isGraphQlErrorResult)(channel)) {
            console.log(channel.message);
        }
        else {
            console.log(`Created channel ${channel.code}`);
            await roleService.assignRoleToChannel(ctxAdmin, superAdminRole.id, channel.id);
            await roleService.assignRoleToChannel(ctxAdmin, customerRole.id, channel.id);
        }
    }
}
//# sourceMappingURL=generate-many-channels.js.map