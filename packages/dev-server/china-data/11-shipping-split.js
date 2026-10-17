"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateShippingSplit = populateShippingSplit;
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const core_1 = require("@vendure/core");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
async function populateShippingSplit(app) {
    const channelService = app.get(core_1.ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();
    // 1. 新建 shop-b 渠道（若已存在则跳过）
    await createShopBChannel(app);
    const allChannels = await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel));
    const shopA = allChannels.items.find(c => c.code === 'shop-a');
    const shopB = allChannels.items.find(c => c.code === 'shop-b');
    if (!shopA)
        throw new Error('shop-a channel not found');
    if (!shopB)
        throw new Error('shop-b channel not found');
    // 2. 为两租户配置配送方式 / 配送档案 / 支付档案
    const shopAProfiles = await configureTenant(app, shopA, SHOP_A_SPLIT);
    const shopBProfiles = await configureTenant(app, shopB, SHOP_B_SPLIT);
    // 3. 把测试变体绑定到对应配送档案（触发分箱 + 拆单）
    await assignCartVariants(app, defaultChannel, [
        ...SHOP_A_SPLIT.assign.map(a => ({ sku: a.sku, profileId: shopAProfiles[a.profile].id })),
        ...SHOP_B_SPLIT.assign.map(a => ({ sku: a.sku, profileId: shopBProfiles[a.profile].id })),
    ]);
}
async function createShopBChannel(app) {
    const channelService = app.get(core_1.ChannelService);
    const zoneService = app.get(core_1.ZoneService);
    const defaultChannel = await channelService.getDefaultChannel();
    const existing = (await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel)))
        .items.find(c => c.code === 'shop-b');
    if (existing)
        return;
    // 创建渠道
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        const asiaZone = (await zoneService.findAll(ctx)).items.find(z => z.name === 'Asia');
        if (!asiaZone)
            throw new Error('Asia zone not found');
        await channelService.create(ctx, {
            code: 'shop-b',
            token: 'shop-b-token',
            defaultCurrencyCode: core_1.CurrencyCode.CNY,
            availableCurrencyCodes: [core_1.CurrencyCode.CNY],
            defaultLanguageCode: core_1.LanguageCode.zh_Hans,
            availableLanguageCodes: [core_1.LanguageCode.zh_Hans],
            pricesIncludeTax: true,
            defaultTaxZoneId: asiaZone.id,
            defaultShippingZoneId: asiaZone.id,
            customFields: {
                couponStackable: true,
                maxStackableCount: 3,
                employeePickupMode: 'loose',
                defaultLocation: { lat: 23.129110, lng: 113.264360 },
                authConfig: {
                    enabledMethods: ['native', 'phone', 'wechat'],
                    overridesJson: '',
                    ssoProvidersJson: '[]',
                },
            },
        });
    });
    const shopB = (await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel)))
        .items.find(c => c.code === 'shop-b');
    if (!shopB)
        throw new Error('shop-b channel not found after creation');
    // 角色关联：仅需补 customer。superadmin 角色由 CJKPlugin 在 ChannelEvent('created') 时自动覆盖新渠道
    // （plugin.ts 订阅），此处若再 assignRoleToChannel 超管角色会重复插入 role_channels_channel（复合主键）触发冲突。
    const roleService = app.get(core_1.RoleService);
    const adminCtx = await (0, shared_1.createAdminCtx)(app, defaultChannel);
    await roleService.assignRoleToChannel(adminCtx, (await roleService.getCustomerRole(adminCtx)).id, shopB.id);
    // 共享默认库存地点，避免 shop-b 下单库存检查失败
    const stockLocationService = app.get(core_1.StockLocationService);
    const defaultStockLocation = await stockLocationService.defaultStockLocation(adminCtx);
    if (defaultStockLocation) {
        await channelService.assignToChannels(adminCtx, core_1.StockLocation, defaultStockLocation.id, [shopB.id]);
    }
    // 商品分配到 shop-b
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        const productService = app.get(core_1.ProductService);
        const products = await productService.findAll(ctx, { take: 999 });
        await productService.assignProductsToChannel(ctx, {
            channelId: shopB.id,
            productIds: products.items.map(p => p.id),
        });
    });
}
async function configureTenant(app, channel, cfg) {
    const result = {
        standard: undefined,
        prepay: undefined,
    };
    await (0, shared_1.withCtx)(app, channel, async (ctx) => {
        // 1. 补齐配送方式（缺失才建，避免与既有重复）
        await ensureShippingMethods(app, ctx, cfg.ensureShipping);
        // 2. 补齐支付方式（shop-b 需自建；shop-a 已有则跳过）
        await ensurePaymentMethods(app, ctx, cfg.ensurePayment);
        const smByCode = idMap((await app.get(core_1.ShippingMethodService).findAll(ctx, { take: 999 })).items, 'code');
        const pmByCode = idMap((await app.get(core_1.PaymentMethodService).findAll(ctx, { take: 999 })).items, 'code');
        // 3. 支付档案：标准[支付含货到付款] / 仅预付[仅测试支付]
        const paymentProfileService = app.get(cjk_plugin_1.PaymentProfileService);
        const stdPay = await paymentProfileService.create(ctx, {
            name: `${cfg.channelCode} 标准支付`,
            description: '含测试支付与货到付款',
            code: `${cfg.channelCode}-pay-standard`,
            isGlobal: false,
            paymentMethodIds: cfg.standardProfilePayMethods.map(c => pmByCode.get(c)),
        });
        const prepayPay = await paymentProfileService.create(ctx, {
            name: `${cfg.channelCode} 仅预付`,
            description: '仅支持测试支付（不支持货到付款，用于拆单验证）',
            code: `${cfg.channelCode}-pay-prepay`,
            isGlobal: false,
            paymentMethodIds: cfg.prepayProfilePayMethods.map(c => pmByCode.get(c)),
        });
        // 4. 配送档案：标准配档(默认) / 预付配档
        const shippingProfileService = app.get(cjk_plugin_1.ShippingProfileService);
        const standardProfile = await shippingProfileService.create(ctx, {
            name: cfg.standard.name,
            description: cfg.standard.description,
            code: cfg.standard.code,
            isGlobal: false,
            shippingMethodIds: cfg.standard.shipping.map(c => smByCode.get(c)),
            paymentProfileId: stdPay.id,
        });
        await shippingProfileService.setTenantDefault(ctx, standardProfile.id);
        result.standard = { id: standardProfile.id };
        const prepayProfile = await shippingProfileService.create(ctx, {
            name: cfg.prepay.name,
            description: cfg.prepay.description,
            code: cfg.prepay.code,
            isGlobal: false,
            shippingMethodIds: cfg.prepay.shipping.map(c => smByCode.get(c)),
            paymentProfileId: prepayPay.id,
        });
        result.prepay = { id: prepayProfile.id };
    });
    return result;
}
async function ensureShippingMethods(app, ctx, codes) {
    const shippingMethodService = app.get(core_1.ShippingMethodService);
    const existing = new Set((await shippingMethodService.findAll(ctx, { take: 999 })).items.map(m => m.code));
    for (const code of codes) {
        if (existing.has(code))
            continue;
        const src = sources_1.DEFAULT_SHIPPING_METHODS.find(m => m.code === code);
        if (!src)
            throw new Error(`配送方式模板缺失: ${code}`);
        await shippingMethodService.create(ctx, {
            code: src.code,
            translations: [
                {
                    languageCode: ctx.languageCode,
                    name: src.name,
                    description: src.description,
                },
            ],
            fulfillmentHandler: src.fulfillmentHandler,
            checker: src.checker,
            calculator: src.calculator,
        });
    }
}
async function ensurePaymentMethods(app, ctx, codes) {
    if (codes.length === 0)
        return;
    const paymentMethodService = app.get(core_1.PaymentMethodService);
    const existing = new Set((await paymentMethodService.findAll(ctx, { take: 999 })).items.map(pm => pm.code));
    for (const code of codes) {
        if (existing.has(code))
            continue;
        const src = sources_1.PAYMENT_METHODS.find(pm => pm.code === code);
        if (!src)
            throw new Error(`支付方式模板缺失: ${code}`);
        await paymentMethodService.create(ctx, {
            code: src.code,
            enabled: true,
            handler: src.handler,
            translations: [
                { languageCode: ctx.languageCode, name: src.name, description: src.description },
            ],
        });
    }
}
async function assignCartVariants(app, defaultChannel, assigns) {
    const productVariantService = app.get(core_1.ProductVariantService);
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        for (const a of assigns) {
            const variants = await productVariantService.findAll(ctx, {
                filter: { sku: { eq: a.sku } },
                take: 1,
            });
            const v = variants.items[0];
            if (!v) {
                console.warn(`[populate] split 变体未找到: ${a.sku}, skip`);
                continue;
            }
            await productVariantService.update(ctx, [
                {
                    id: v.id,
                    customFields: {
                        shippingProfileId: String(a.profileId),
                        paymentProfileId: null,
                    },
                },
            ]);
        }
    });
}
function idMap(items, key) {
    return new Map(items.map(it => [String(it[key]), it.id]));
}
// ===== 两租户配置 =====
const SHOP_A_SPLIT = {
    channelCode: 'shop-a',
    ensureShipping: ['sf-express-fast', 'zto-express'],
    ensurePayment: [],
    standardProfilePayMethods: ['dummy-payment', 'cash-on-delivery'],
    prepayProfilePayMethods: ['dummy-payment'],
    standard: {
        code: 'shop-a-split-standard',
        name: 'shop-a 标准配档',
        description: '顺丰特快 / 中通快递',
        shipping: ['sf-express-fast', 'zto-express'],
    },
    prepay: {
        code: 'shop-a-split-prepay',
        name: 'shop-a 预付配档',
        description: '仅测试支付，不支持货到付款',
        shipping: ['zto-express'],
    },
    assign: [{ sku: 'NF-RICE-5KG', profile: 'standard' }],
};
const SHOP_B_SPLIT = {
    channelCode: 'shop-b',
    ensureShipping: ['jd-logistics', 'deppon-express'],
    ensurePayment: ['dummy-payment', 'cash-on-delivery'],
    standardProfilePayMethods: ['dummy-payment', 'cash-on-delivery'],
    prepayProfilePayMethods: ['dummy-payment'],
    standard: {
        code: 'shop-b-split-standard',
        name: 'shop-b 标准配档',
        description: '京东物流 / 德邦快递',
        shipping: ['jd-logistics', 'deppon-express'],
    },
    prepay: {
        code: 'shop-b-split-prepay',
        name: 'shop-b 预付配档',
        description: '仅测试支付，不支持货到付款',
        shipping: ['jd-logistics'],
    },
    assign: [{ sku: 'HW-ROUTER-STD', profile: 'prepay' }],
};
//# sourceMappingURL=11-shipping-split.js.map