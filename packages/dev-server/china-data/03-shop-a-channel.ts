import { INestApplication } from '@nestjs/common';
import { PickupLocationService } from '@vendure/cjk-plugin';
import {
    ChannelService,
    CurrencyCode,
    LanguageCode,
    ProductService,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    RoleService,
    ShippingMethodService,
    PaymentMethodService,
    StockLocation,
    StockLocationService,
    ZoneService,
} from '@vendure/core';

import { withCtx, yuanToCents, getSuperAdminUser, createAdminCtx } from './shared';
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
    try {
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
    } catch (e: any) {
        throw new Error(`[step1 channelService.create] ${e.message}`);
    }

    // 重新查询 shop-a Channel
    let shopAChannel;
    try {
        const allChannels = await channelService.findAll(
            await createAdminCtx(app, defaultChannel),
        );
        shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
        if (!shopAChannel) throw new Error('shop-a channel not found after creation');
    } catch (e: any) {
        throw new Error(`[step2 findAll shop-a] ${e.message}`);
    }

    // 将 shop-a 添加到 superadmin role 的 channels（否则 assignProductsToChannel 会 forbidden）
    try {
        const roleService = app.get(RoleService);
        const adminCtx = await createAdminCtx(app, defaultChannel);
        const superAdminRole = await roleService.getSuperAdminRole(adminCtx);
        await roleService.assignRoleToChannel(adminCtx, superAdminRole.id, shopAChannel.id);
    } catch (e: any) {
        throw new Error(`[step2.5 assignRoleToChannel] ${e.message}`);
    }

    // 将 default stock location 分配给 shop-a channel（否则 shop-a ctx 下 getAllStockLocations 返回空，下单时 stock 检查失败）
    try {
        const stockLocationService = app.get(StockLocationService);
        const adminCtx = await createAdminCtx(app, defaultChannel);
        const defaultStockLocation = await stockLocationService.defaultStockLocation(adminCtx);
        if (defaultStockLocation) {
            await channelService.assignToChannels(adminCtx, StockLocation, defaultStockLocation.id, [
                shopAChannel.id,
            ]);
        }
    } catch (e: any) {
        throw new Error(`[step2.6 assignStockLocationToShopA] ${e.message}`);
    }

    // 2. 将 default Channel 的全部商品分配到 shop-a
    try {
        await withCtx(app, defaultChannel, async ctx => {
            const productService = app.get(ProductService);
            const products = await productService.findAll(ctx, { take: 999 });
            const productIds = products.items.map(p => p.id as string);
            await productService.assignProductsToChannel(ctx, {
                channelId: shopAChannel.id,
                productIds,
            });
        });
    } catch (e: any) {
        throw new Error(`[step3 assignProductsToChannel] ${e.message}`);
    }

    // 3. 切换到 shop-a Channel ctx，配置数据
    // 注意：stock level 按 stock location 共享，shop-a 已关联 default stock location，
    // 无需单独设置库存（共享 default Channel 的 stock）
    try {
        await withCtx(app, shopAChannel, async ctx => {
            await overrideShopAPrices(app, ctx);
            await createShippingMethods(app, ctx);
            await createPaymentMethods(app, ctx);
            await createPickupLocations(app, ctx);
        });
    } catch (e: any) {
        throw new Error(`[step4 shop-a config] ${e.message}`);
    }
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
