import { INestApplication } from '@nestjs/common';
import { PickupLocationService } from '@vendure/cjk-plugin';
import {
    ChannelService,
    CurrencyCode,
    LanguageCode,
    ProductService,
    ProductVariantService,
    RequestContext,
    ShippingMethodService,
    PaymentMethodService,
    ZoneService,
} from '@vendure/core';

import { withCtx, yuanToCents } from './shared';
import { PAYMENT_METHODS, SHOP_A_PICKUP_LOCATIONS, SHOP_A_SHIPPING_METHODS } from './sources';

// shop-a 上五常大米便宜 5 元
const SHOP_A_PRICE_OVERRIDE: Record<string, number> = {
    'NF-RICE-5KG': 44,
};

export async function populateShopAChannel(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const zoneService = app.get(ZoneService);
    const defaultChannel = await channelService.getDefaultChannel();

    // 1. 在 default Channel ctx 下创建 shop-a Channel
    await withCtx(app, defaultChannel, async ctx => {
        const zones = await zoneService.findAll(ctx);
        const asiaZone = zones.items.find(z => z.name === 'Asia');
        if (!asiaZone) throw new Error('Asia zone not found');

        await channelService.create(ctx, {
            code: 'shop-a',
            token: 'shop-a-token',
            defaultCurrencyCode: CurrencyCode.CNY,
            availableCurrencyCodes: [CurrencyCode.CNY],
            defaultLanguageCode: LanguageCode.zh_Hans,
            availableLanguageCodes: [LanguageCode.zh_Hans],
            pricesIncludeTax: true,
            defaultTaxZoneId: asiaZone.id,
            defaultShippingZoneId: asiaZone.id,
            customFields: { couponStackable: true, maxStackableCount: 3 },
        });
    });

    // 重新查询 shop-a Channel（create 返回类型含 ErrorResult 联合，findAll 更稳妥）
    const allChannels = await channelService.findAll(
        await app.get('RequestContextService').create({ apiType: 'admin', channelOrToken: defaultChannel }),
    );
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
    if (!shopAChannel) throw new Error('shop-a channel not found after creation');

    // 2. 将 default Channel 的全部商品分配到 shop-a（在 default Channel ctx 下调用）
    await withCtx(app, defaultChannel, async ctx => {
        const productService = app.get(ProductService);
        const products = await productService.findAll(ctx, { take: 999 });
        const productIds = products.items.map(p => p.id as string);
        await productService.assignProductsToChannel(ctx, {
            channelId: shopAChannel.id,
            productIds,
        });
    });

    // 3. 切换到 shop-a Channel ctx，配置数据
    await withCtx(app, shopAChannel, async ctx => {
        await overrideShopAPrices(app, ctx);
        await createShippingMethods(app, ctx);
        await createPaymentMethods(app, ctx);
        await createPickupLocations(app, ctx);
    });
}

async function overrideShopAPrices(app: INestApplication, ctx: RequestContext): Promise<void> {
    const productVariantService = app.get(ProductVariantService);
    const updates: Array<{ id: string; price: number }> = [];

    for (const sku of Object.keys(SHOP_A_PRICE_OVERRIDE)) {
        const variants = await productVariantService.findAll(ctx, {
            filter: { sku: { eq: sku } },
            take: 1,
        });
        const variant = variants.items[0];
        if (!variant) continue;
        updates.push({
            id: variant.id as string,
            price: yuanToCents(SHOP_A_PRICE_OVERRIDE[sku]),
        });
    }

    if (updates.length > 0) {
        await productVariantService.update(
            ctx,
            updates.map(u => ({ id: u.id, price: u.price })),
        );
    }
}

async function createShippingMethods(app: INestApplication, ctx: RequestContext): Promise<void> {
    const shippingMethodService = app.get(ShippingMethodService);
    for (const sm of SHOP_A_SHIPPING_METHODS) {
        await shippingMethodService.create(ctx, {
            code: sm.code,
            translations: [
                {
                    languageCode: ctx.languageCode,
                    name: sm.name,
                    description: sm.description,
                },
            ],
            fulfillmentHandler: sm.fulfillmentHandler,
            checker: sm.checker,
            calculator: sm.calculator,
        });
    }
}

async function createPaymentMethods(app: INestApplication, ctx: RequestContext): Promise<void> {
    const paymentMethodService = app.get(PaymentMethodService);
    for (const pm of PAYMENT_METHODS) {
        await paymentMethodService.create(ctx, {
            code: pm.code,
            enabled: true,
            handler: pm.handler,
            translations: [
                {
                    languageCode: ctx.languageCode,
                    name: pm.name,
                    description: pm.description,
                },
            ],
        });
    }
}

async function createPickupLocations(app: INestApplication, ctx: RequestContext): Promise<void> {
    const pickupLocationService = app.get(PickupLocationService);
    for (const loc of SHOP_A_PICKUP_LOCATIONS) {
        await pickupLocationService.create(ctx, {
            name: loc.name,
            type: loc.type,
            address: loc.address,
            phoneNumber: loc.phoneNumber,
            businessHours: loc.businessHours,
        });
    }
}
