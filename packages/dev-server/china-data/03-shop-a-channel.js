"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateShopAChannel = populateShopAChannel;
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const core_1 = require("@vendure/core");
const shared_1 = require("./shared");
const sources_1 = require("./sources");
// shop-a 上五常大米便宜 5 元
const SHOP_A_PRICE_OVERRIDE = {
    'NF-RICE-5KG': 44,
};
async function populateShopAChannel(app) {
    const channelService = app.get(core_1.ChannelService);
    const zoneService = app.get(core_1.ZoneService);
    const defaultChannel = await channelService.getDefaultChannel();
    // 1. 在 default Channel ctx 下创建 shop-a Channel
    try {
        await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
            const zones = await zoneService.findAll(ctx);
            const asiaZone = zones.items.find(z => z.name === 'Asia');
            if (!asiaZone)
                throw new Error('Asia zone not found');
            await channelService.create(ctx, {
                code: 'shop-a',
                token: 'shop-a-token',
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
                    employeePickupMode: 'strict',
                    defaultLocation: { lat: 43.525870, lng: 125.668950 },
                    authConfig: {
                        enabledMethods: ['native', 'phone', 'wechat', 'sso'],
                        overridesJson: JSON.stringify({
                            wechat: {
                                appId: 'wx-tenant-a',
                                appSecret: 'secret-a',
                                miniProgramAppId: 'mini-a',
                                token: 'tenant-a-msg-token',
                                encodingAESKey: 'tenant-a-43-char-encoding-aes-key-herexxxxxxxx',
                            }
                        }),
                        ssoProvidersJson: JSON.stringify([
                            {
                                name: '企业SSO',
                                providerKey: 'zhao-sso-dev',
                                protocol: 'zhao-sso',
                                baseUrl: 'https://h.joho.cn/api/zhao-sso',
                                clientId: 'vendure-shop-a',
                                clientSecret: 'shop-a-app-secret',
                                channelCode: 'shop-a',
                            }
                        ]),
                    },
                },
            });
        });
    }
    catch (e) {
        throw new Error(`[step1 channelService.create] ${e.message}`);
    }
    // 重新查询 shop-a Channel
    let shopAChannel;
    try {
        const allChannels = await channelService.findAll(await (0, shared_1.createAdminCtx)(app, defaultChannel));
        shopAChannel = allChannels.items.find(c => c.code === 'shop-a');
        if (!shopAChannel)
            throw new Error('shop-a channel not found after creation');
    }
    catch (e) {
        throw new Error(`[step2 findAll shop-a] ${e.message}`);
    }
    // 仅补 customer role：ChannelService.create 不会自动给新渠道分配客户角色，
    // 缺失会导致 shop-a 渠道客户会话 channelPermissions 缺 Authenticated，
    // 所有 @Allow(Authenticated) 的 Shop 查询（me/myOrderPackages）均被 Forbidden 拦截。
    // superadmin 角色已由 CJKPlugin 在 ChannelEvent('created') 时自动覆盖新渠道
    // （plugin.ts 订阅 + OnModuleInit 存量覆盖），此处不再手动 assignRoleToChannel 超管角色，
    // 否则与自动分配竞争会重复插入 role_channels_channel（复合主键）触发冲突。
    try {
        const roleService = app.get(core_1.RoleService);
        const adminCtx = await (0, shared_1.createAdminCtx)(app, defaultChannel);
        const customerRole = await roleService.getCustomerRole(adminCtx);
        await roleService.assignRoleToChannel(adminCtx, customerRole.id, shopAChannel.id);
    }
    catch (e) {
        throw new Error(`[step2.5 assignRoleToChannel] ${e.message}`);
    }
    // 将 default stock location 分配给 shop-a channel（否则 shop-a ctx 下 getAllStockLocations 返回空，下单时 stock 检查失败）
    try {
        const stockLocationService = app.get(core_1.StockLocationService);
        const adminCtx = await (0, shared_1.createAdminCtx)(app, defaultChannel);
        const defaultStockLocation = await stockLocationService.defaultStockLocation(adminCtx);
        if (defaultStockLocation) {
            await channelService.assignToChannels(adminCtx, core_1.StockLocation, defaultStockLocation.id, [
                shopAChannel.id,
            ]);
        }
    }
    catch (e) {
        throw new Error(`[step2.6 assignStockLocationToShopA] ${e.message}`);
    }
    // 2. 将 default Channel 的全部商品分配到 shop-a
    try {
        await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
            const productService = app.get(core_1.ProductService);
            const products = await productService.findAll(ctx, { take: 999 });
            const productIds = products.items.map(p => p.id);
            await productService.assignProductsToChannel(ctx, {
                channelId: shopAChannel.id,
                productIds,
            });
        });
    }
    catch (e) {
        throw new Error(`[step3 assignProductsToChannel] ${e.message}`);
    }
    // 3. 切换到 shop-a Channel ctx，配置数据
    // 注意：stock level 按 stock location 共享，shop-a 已关联 default stock location，
    // 无需单独设置库存（共享 default Channel 的 stock）
    try {
        await (0, shared_1.withCtx)(app, shopAChannel, async (ctx) => {
            await overrideShopAPrices(app, ctx);
            await createShippingMethods(app, ctx);
            await createPaymentMethods(app, ctx);
            await createPickupLocations(app, ctx);
            await createShopAEmployeeCustomers(app, ctx);
        });
    }
    catch (e) {
        throw new Error(`[step4 shop-a config] ${e.message}`);
    }
}
async function overrideShopAPrices(app, ctx) {
    const productVariantService = app.get(core_1.ProductVariantService);
    const updates = [];
    for (const sku of Object.keys(SHOP_A_PRICE_OVERRIDE)) {
        const variants = await productVariantService.findAll(ctx, {
            filter: { sku: { eq: sku } },
            take: 1,
        });
        const variant = variants.items[0];
        if (!variant)
            continue;
        updates.push({
            id: variant.id,
            price: (0, shared_1.yuanToCents)(SHOP_A_PRICE_OVERRIDE[sku]),
        });
    }
    if (updates.length > 0) {
        await productVariantService.update(ctx, updates.map(u => ({ id: u.id, price: u.price })));
    }
}
async function createShippingMethods(app, ctx) {
    const shippingMethodService = app.get(core_1.ShippingMethodService);
    for (const sm of sources_1.SHOP_A_SHIPPING_METHODS) {
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
async function createPaymentMethods(app, ctx) {
    const paymentMethodService = app.get(core_1.PaymentMethodService);
    for (const pm of sources_1.PAYMENT_METHODS) {
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
async function createPickupLocations(app, ctx) {
    var _a;
    const pickupLocationService = app.get(cjk_plugin_1.PickupLocationService);
    for (const loc of sources_1.SHOP_A_PICKUP_LOCATIONS) {
        await pickupLocationService.create(ctx, {
            name: loc.name,
            type: loc.type,
            address: loc.address,
            phoneNumber: loc.phoneNumber,
            businessHours: loc.businessHours,
            coordinates: loc.coordinates,
            isPublic: (_a = loc.isPublic) !== null && _a !== void 0 ? _a : false,
        });
    }
}
async function createShopAEmployeeCustomers(app, ctx) {
    const employeeCustomerService = app.get(cjk_plugin_1.EmployeeCustomerService);
    const customerService = app.get(core_1.CustomerService);
    const pickupLocationService = app.get(cjk_plugin_1.PickupLocationService);
    // 通过 emailAddress 精确查找 shop-a 测试客户 wangwu@test.cn
    const customers = await customerService.findAll(ctx, {
        filter: { emailAddress: { eq: 'wangwu@test.cn' } },
        take: 1,
    });
    const testCustomer = customers.items[0];
    if (!testCustomer) {
        console.warn('[populate] wangwu@test.cn not found in shop-a, skip EmployeeCustomer binding');
        return;
    }
    // 查找吉林农业大学自提点（shop-a 自建，非公共）
    const locations = await pickupLocationService.findByType(ctx, 'employee');
    const jlauLocation = locations.find(l => l.name.includes('吉林农业大学'));
    if (!jlauLocation) {
        console.warn('[populate] 吉林农业大学自提点 not found in shop-a, skip EmployeeCustomer binding');
        return;
    }
    try {
        await employeeCustomerService.create(ctx, {
            customerId: testCustomer.id,
            enterpriseName: '吉林农业大学',
            employeeId: 'JLNY20240088',
            pickupLocationIds: [jlauLocation.id],
            verified: true, // shop-a 是 strict 模式，必须 verified=true 才能下单
        });
    }
    catch (e) {
        console.warn(`[populate] shop-a EmployeeCustomer binding skipped: ${e.message}`);
    }
}
//# sourceMappingURL=03-shop-a-channel.js.map