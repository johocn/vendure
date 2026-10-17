"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateDefaultChannel = populateDefaultChannel;
const cjk_plugin_1 = require("@vendure/cjk-plugin");
const core_1 = require("@vendure/core");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("./shared");
const sources_1 = require("./sources");
const ASSETS_DIR = path_1.default.join(__dirname, '../../core/mock-data/assets');
async function populateDefaultChannel(app) {
    const channelService = app.get(core_1.ChannelService);
    const zoneService = app.get(core_1.ZoneService);
    const ctxService = app.get(core_1.RequestContextService);
    const conn = app.get(core_1.TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();
    // 1. 先用初始 ctx 更新 default Channel 的字段
    await (0, shared_1.withCtx)(app, defaultChannel, async (ctx) => {
        const zones = await zoneService.findAll(ctx);
        const asiaZone = zones.items.find(z => z.name === 'Asia');
        if (!asiaZone)
            throw new Error('Asia zone not found');
        await channelService.update(ctx, {
            id: defaultChannel.id,
            token: 'default-token',
            defaultCurrencyCode: core_1.CurrencyCode.CNY,
            availableCurrencyCodes: [core_1.CurrencyCode.CNY],
            defaultLanguageCode: core_1.LanguageCode.zh_Hans,
            availableLanguageCodes: [core_1.LanguageCode.zh_Hans, core_1.LanguageCode.en],
            defaultTaxZoneId: asiaZone.id,
            defaultShippingZoneId: asiaZone.id,
            customFields: {
                couponStackable: false,
                maxStackableCount: null,
                employeePickupMode: 'loose',
                defaultLocation: { lat: 43.526210, lng: 125.664780 },
                authConfig: {
                    enabledMethods: ['native', 'phone', 'wechat', 'alipay', 'douyin', 'sso'],
                    overridesJson: '',
                    ssoProvidersJson: JSON.stringify([
                        {
                            name: '企业 SSO (h.joho.cn)',
                            providerKey: 'zhao-sso-youshop-default',
                            protocol: 'zhao-sso',
                            baseUrl: 'https://h.joho.cn/api/zhao-sso',
                            clientId: 'vendure-youshop',
                            clientSecret: 'youshop-app-secret',
                            channelCode: 'default',
                        }
                    ]),
                },
            },
        });
    });
    // 2. 直接通过 repository 确认 defaultTaxZone 已写入，并强制重新加载 Channel 实体
    const channelRepo = conn.rawConnection.getRepository('Channel');
    const zoneRepo = conn.rawConnection.getRepository('Zone');
    const asiaZoneEntity = await zoneRepo.findOne({ where: { name: 'Asia' } });
    if (asiaZoneEntity) {
        await channelRepo.update(defaultChannel.id, {
            defaultTaxZone: asiaZoneEntity,
            defaultShippingZone: asiaZoneEntity,
        });
    }
    // 3. 用 token 字符串构造 ctx，强制从刷新后的缓存重新获取 Channel（含 defaultTaxZone 关系）
    const superAdmin = await (0, shared_1.getSuperAdminUser)(app);
    const freshCtx = await ctxService.create({
        apiType: 'admin',
        channelOrToken: defaultChannel.token || '__default_channel__',
        user: superAdmin,
    });
    // 验证 taxZone 已加载
    if (!freshCtx.channel.defaultTaxZone) {
        // 如果 token 方式仍然拿不到 taxZone，直接用 findOne 手动加载
        const freshChannel = await channelService.findOne(freshCtx, defaultChannel.id);
        if (freshChannel === null || freshChannel === void 0 ? void 0 : freshChannel.defaultTaxZone) {
            const ctx2 = await ctxService.create({ apiType: 'admin', channelOrToken: freshChannel });
            await createProducts(app, ctx2);
            await createShippingMethods(app, ctx2);
            await createPaymentMethods(app, ctx2);
            await createPickupLocations(app, ctx2);
            await createRoles(app, ctx2, defaultChannel.id);
            await createEmployeeCustomers(app, ctx2);
            return;
        }
        throw new Error('defaultTaxZone still null after update');
    }
    // 4. 商品 + 图片 + 配送 + 支付 + 自提点 + 角色 + 企业绑定
    await createProducts(app, freshCtx);
    await createShippingMethods(app, freshCtx);
    await createPaymentMethods(app, freshCtx);
    await createPickupLocations(app, freshCtx);
    await createRoles(app, freshCtx, defaultChannel.id);
    await createEmployeeCustomers(app, freshCtx);
}
async function createProducts(app, ctx) {
    const productService = app.get(core_1.ProductService);
    const productVariantService = app.get(core_1.ProductVariantService);
    const facetService = app.get(core_1.FacetService);
    const assetService = app.get(core_1.AssetService);
    const taxCategoryService = app.get(core_1.TaxCategoryService);
    const stockMovementService = app.get(core_1.StockMovementService);
    const optionGroupService = app.get(core_1.ProductOptionGroupService);
    const optionService = app.get(core_1.ProductOptionService);
    const allFacets = await facetService.findAll(ctx);
    const taxCategories = await taxCategoryService.findAll(ctx);
    const standardTax = taxCategories.items.find(tc => tc.name === '普通税率');
    if (!standardTax)
        throw new Error('TaxCategory 普通税率 not found');
    for (const p of sources_1.PRODUCTS) {
        // 导入图片（复用 mock-data/assets）
        const filePath = path_1.default.join(ASSETS_DIR, p.imageFile);
        const stream = fs_1.default.createReadStream(filePath);
        const assetResult = await assetService.createFromFileStream(stream, filePath, ctx);
        if (!('id' in assetResult)) {
            throw new Error(`Asset creation failed for ${p.imageFile}: ${assetResult.message}`);
        }
        // 找到 brand 和 category 的 facetValueId
        const facetValueIds = [];
        for (const facet of allFacets.items) {
            for (const fv of facet.values) {
                if (fv.name === p.brand || fv.name === p.category) {
                    facetValueIds.push(fv.id);
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
            assetIds: [assetResult.id],
        });
        // 多变体商品需创建 ProductOptionGroup（Vendure 不允许同 Product 下多个无选项的 Variant）
        let optionIds = [];
        if (p.variants.length > 1) {
            const group = await optionGroupService.create(ctx, {
                code: `${p.slug}-spec`,
                translations: [{ languageCode: ctx.languageCode, name: '规格' }],
            });
            await productService.addOptionGroupToProduct(ctx, product.id, group.id);
            for (const v of p.variants) {
                const opt = await optionService.create(ctx, group, {
                    code: v.sku,
                    translations: [{ languageCode: ctx.languageCode, name: v.name }],
                });
                optionIds.push(opt.id);
            }
        }
        // 创建 ProductVariant（多变体商品需传 optionIds）
        const createdVariants = await productVariantService.create(ctx, p.variants.map((v, i) => ({
            productId: product.id,
            sku: v.sku,
            translations: [{ languageCode: ctx.languageCode, name: v.name }],
            price: (0, shared_1.yuanToCents)(v.price),
            taxCategoryId: standardTax.id,
            optionIds: optionIds.length > 0 ? [optionIds[i]] : undefined,
            customFields: {
                weight: v.weight,
                length: v.length,
                width: v.width,
                height: v.height,
            },
        })));
        // 调整库存（StockMovementService.adjustProductVariantStock）
        for (let i = 0; i < createdVariants.length; i++) {
            const variant = createdVariants[i];
            const stock = p.variants[i].stock;
            await stockMovementService.adjustProductVariantStock(ctx, variant.id, stock);
        }
    }
}
async function createShippingMethods(app, ctx) {
    const shippingMethodService = app.get(core_1.ShippingMethodService);
    for (const sm of sources_1.DEFAULT_SHIPPING_METHODS) {
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
    for (const loc of sources_1.DEFAULT_PICKUP_LOCATIONS) {
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
// TenantAdmin 权限：本 channel 全权（不含 SuperAdmin），加自提点/EmployeeCustomer 全部权限
const TENANT_ADMIN_PERMISSIONS = [
    core_1.Permission.Authenticated,
    core_1.Permission.Owner,
    core_1.Permission.ReadOrder,
    core_1.Permission.UpdateOrder,
    core_1.Permission.CreateCustomer,
    core_1.Permission.ReadCustomer,
    core_1.Permission.UpdateCustomer,
    cjk_plugin_1.PickupPermissions.ReadPickupLocation,
    cjk_plugin_1.PickupPermissions.CreatePickupLocation,
    cjk_plugin_1.PickupPermissions.UpdatePickupLocation,
    cjk_plugin_1.PickupPermissions.DeletePickupLocation,
    cjk_plugin_1.PickupPermissions.AssignPickupLocation,
    cjk_plugin_1.PickupPermissions.ReadEmployeeCustomer,
    cjk_plugin_1.PickupPermissions.CreateEmployeeCustomer,
    cjk_plugin_1.PickupPermissions.UpdateEmployeeCustomer,
    cjk_plugin_1.PickupPermissions.DeleteEmployeeCustomer,
    cjk_plugin_1.PickupPermissions.BindPickupLocation,
    cjk_plugin_1.PickupPermissions.VerifyEmployeeCustomer,
];
// SalesPerson 权限：只读自提点 + 创建 EmployeeCustomer（不允许 Verify）
const SALES_PERSON_PERMISSIONS = [
    core_1.Permission.Authenticated,
    core_1.Permission.Owner,
    core_1.Permission.ReadOrder,
    core_1.Permission.ReadCustomer,
    cjk_plugin_1.PickupPermissions.ReadPickupLocation,
    cjk_plugin_1.PickupPermissions.ReadEmployeeCustomer,
    cjk_plugin_1.PickupPermissions.CreateEmployeeCustomer,
];
async function createRoles(app, ctx, channelId) {
    const roleService = app.get(core_1.RoleService);
    try {
        await roleService.create(ctx, {
            code: 'tenant-admin',
            description: '租户管理员',
            permissions: TENANT_ADMIN_PERMISSIONS,
            channelIds: [channelId],
        });
    }
    catch (e) {
        console.warn(`[populate] tenant-admin role creation skipped: ${e.message}`);
    }
    try {
        await roleService.create(ctx, {
            code: 'sales-person',
            description: '销售人员',
            permissions: SALES_PERSON_PERMISSIONS,
            channelIds: [channelId],
        });
    }
    catch (e) {
        console.warn(`[populate] sales-person role creation skipped: ${e.message}`);
    }
}
async function createEmployeeCustomers(app, ctx) {
    const employeeCustomerService = app.get(cjk_plugin_1.EmployeeCustomerService);
    const customerService = app.get(core_1.CustomerService);
    const pickupLocationService = app.get(cjk_plugin_1.PickupLocationService);
    // 通过 emailAddress 精确查找测试客户 zhangsan@test.cn
    const customers = await customerService.findAll(ctx, {
        filter: { emailAddress: { eq: 'zhangsan@test.cn' } },
        take: 1,
    });
    const testCustomer = customers.items[0];
    if (!testCustomer) {
        console.warn('[populate] zhangsan@test.cn not found, skip EmployeeCustomer binding');
        return;
    }
    // 查找长春科技学院自提点（employee 类型，isPublic=true）
    const locations = await pickupLocationService.findByType(ctx, 'employee');
    const cctuLocation = locations.find(l => l.name.includes('长春科技学院'));
    if (!cctuLocation) {
        console.warn('[populate] 长春科技学院自提点 not found, skip EmployeeCustomer binding');
        return;
    }
    try {
        await employeeCustomerService.create(ctx, {
            customerId: testCustomer.id,
            enterpriseName: '长春科技学院',
            employeeId: 'CT20240001',
            pickupLocationIds: [cctuLocation.id],
            verified: false, // default channel 是 loose 模式，verified=false 即可
        });
    }
    catch (e) {
        console.warn(`[populate] EmployeeCustomer binding skipped: ${e.message}`);
    }
}
//# sourceMappingURL=02-default-channel.js.map