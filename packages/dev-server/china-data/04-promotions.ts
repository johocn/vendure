import { INestApplication } from '@nestjs/common';
import { ChannelService, LanguageCode, PromotionService, RequestContext } from '@vendure/core';

import { withCtx } from './shared';
import { PROMOTIONS } from './sources';

export async function populatePromotions(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();

    // 查询 shop-a Channel（需在 default Channel ctx 下调用 findAll）
    const allChannels = await channelService.findAll(
        await app.get('RequestContextService').create({ apiType: 'admin', channelOrToken: defaultChannel }),
    );
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel) throw new Error('shop-a channel not found');

    for (const promo of PROMOTIONS) {
        const targetChannel = promo.channel === 'default' ? defaultChannel : shopAChannel;
        await withCtx(app, targetChannel, async (ctx: RequestContext) => {
            const promotionService = app.get(PromotionService);
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
                        languageCode: LanguageCode.zh_Hans,
                        name: promo.name,
                    },
                ],
                customFields: promo.customFields || {},
            });
        });
    }
}
