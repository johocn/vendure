"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populatePromotions = populatePromotions;
const core_1 = require("@vendure/core");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
async function populatePromotions(app) {
    const channelService = app.get(core_1.ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    // 查询 shop-a Channel（需在 default Channel ctx 下调用 findAll）
    const allChannels = await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel));
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel)
        throw new Error('shop-a channel not found');
    const allPromos = [...sources_1.PROMOTIONS, ...sources_1.TIER_DISCOUNT_PROMOTIONS];
    for (const promo of allPromos) {
        const targetChannel = promo.channel === 'default' ? defaultChannel : shopAChannel;
        await (0, shared_1.withCtx)(app, targetChannel, async (ctx) => {
            const promotionService = app.get(core_1.PromotionService);
            await promotionService.createPromotion(ctx, {
                enabled: true,
                startsAt: new Date('2026-01-01').toISOString(),
                endsAt: new Date('2027-12-31').toISOString(),
                couponCode: promo.couponCode,
                perCustomerUsageLimit: 100,
                conditions: promo.conditions,
                actions: promo.actions,
                translations: [
                    {
                        languageCode: core_1.LanguageCode.zh_Hans,
                        name: promo.name,
                    },
                ],
                customFields: promo.customFields || {},
            });
        });
    }
}
//# sourceMappingURL=04-promotions.js.map