import { INestApplication } from '@nestjs/common';
import { PickupLocationService } from '@vendure/cjk-plugin';
import {
    AssetService,
    ChannelService,
    CurrencyCode,
    FacetService,
    LanguageCode,
    PaymentMethodService,
    ProductService,
    ProductVariantService,
    RequestContext,
    ShippingMethodService,
    StockMovementService,
    TaxCategoryService,
    ZoneService,
} from '@vendure/core';
import fs from 'fs';
import path from 'path';

import { withCtx, yuanToCents } from './shared';
import { DEFAULT_PICKUP_LOCATIONS, DEFAULT_SHIPPING_METHODS, PAYMENT_METHODS, PRODUCTS } from './sources';

const ASSETS_DIR = path.join(__dirname, '../../core/mock-data/assets');

export async function populateDefaultChannel(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const zoneService = app.get(ZoneService);
    const defaultChannel = await channelService.getDefaultChannel();

    await withCtx(app, defaultChannel, async ctx => {
        // 1. 更新 default Channel：CNY / zh_Hans / Asia Zone / couponStackable=false
        const zones = await zoneService.findAll(ctx);
        const asiaZone = zones.items.find(z => z.name === 'Asia');
        if (!asiaZone) throw new Error('Asia zone not found');

        await channelService.update(ctx, {
            id: defaultChannel.id as string,
            defaultCurrencyCode: CurrencyCode.CNY,
            availableCurrencyCodes: [CurrencyCode.CNY],
            defaultLanguageCode: LanguageCode.zh_Hans,
            availableLanguageCodes: [LanguageCode.zh_Hans, LanguageCode.en],
            defaultTaxZoneId: asiaZone.id,
            defaultShippingZoneId: asiaZone.id,
            customFields: { couponStackable: false, maxStackableCount: null },
        });

        // 2. 商品 + 图片
        await createProducts(app, ctx);
        // 3. 配送方式
        await createShippingMethods(app, ctx);
        // 4. 支付方式
        await createPaymentMethods(app, ctx);
        // 5. 自提点
        await createPickupLocations(app, ctx);
    });
}

async function createProducts(app: INestApplication, ctx: RequestContext): Promise<void> {
    const productService = app.get(ProductService);
    const productVariantService = app.get(ProductVariantService);
    const facetService = app.get(FacetService);
    const assetService = app.get(AssetService);
    const taxCategoryService = app.get(TaxCategoryService);
    const stockMovementService = app.get(StockMovementService);

    const allFacets = await facetService.findAll(ctx);
    const taxCategories = await taxCategoryService.findAll(ctx);
    const standardTax = taxCategories.items.find(tc => tc.name === '普通税率');
    if (!standardTax) throw new Error('TaxCategory 普通税率 not found');

    for (const p of PRODUCTS) {
        // 导入图片（复用 mock-data/assets）
        const filePath = path.join(ASSETS_DIR, p.imageFile);
        const stream = fs.createReadStream(filePath);
        const assetResult = await assetService.createFromFileStream(stream, filePath, ctx);
        if (!('id' in assetResult)) {
            throw new Error(`Asset creation failed for ${p.imageFile}: ${assetResult.message}`);
        }

        // 找到 brand 和 category 的 facetValueId
        const facetValueIds: string[] = [];
        for (const facet of allFacets.items) {
            for (const fv of facet.values) {
                if (fv.name === p.brand || fv.name === p.category) {
                    facetValueIds.push(fv.id as string);
                }
            }
        }

        // 创建 Product（需 translations）
        const product = await productService.create(ctx, {
            translations: [
                {
                    languageCode: ctx.languageCode,
                    name: p.name,
                    slug: p.slug,
                    description: p.description,
                },
            ],
            facetValueIds,
            assetIds: [assetResult.id as string],
        });

        // 创建 ProductVariant（ProductVariantService.create 接收数组）
        const createdVariants = await productVariantService.create(
            ctx,
            p.variants.map(v => ({
                productId: product.id,
                sku: v.sku,
                translations: [{ languageCode: ctx.languageCode, name: v.name }],
                price: yuanToCents(v.price),
                taxCategoryId: standardTax.id as string,
            })),
        );

        // 调整库存（StockMovementService.adjustProductVariantStock）
        for (let i = 0; i < createdVariants.length; i++) {
            const variant = createdVariants[i];
            const stock = p.variants[i].stock;
            await stockMovementService.adjustProductVariantStock(ctx, variant.id, stock);
        }
    }
}

async function createShippingMethods(app: INestApplication, ctx: RequestContext): Promise<void> {
    const shippingMethodService = app.get(ShippingMethodService);
    for (const sm of DEFAULT_SHIPPING_METHODS) {
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
    for (const loc of DEFAULT_PICKUP_LOCATIONS) {
        await pickupLocationService.create(ctx, {
            name: loc.name,
            type: loc.type,
            address: loc.address,
            phoneNumber: loc.phoneNumber,
            businessHours: loc.businessHours,
        });
    }
}
