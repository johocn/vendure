import { INestApplication } from '@nestjs/common';
import { EmployeeCustomerService, PickupLocationService, PickupPermissions } from '@vendure/cjk-plugin';
import {
    AssetService,
    ChannelService,
    CurrencyCode,
    CustomerService,
    FacetService,
    ID,
    LanguageCode,
    PaymentMethodService,
    Permission,
    ProductService,
    ProductOptionGroupService,
    ProductOptionService,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    RoleService,
    ShippingMethodService,
    StockMovementService,
    TaxCategoryService,
    TransactionalConnection,
    ZoneService,
} from '@vendure/core';
import fs from 'fs';
import path from 'path';

import { withCtx, yuanToCents, getSuperAdminUser } from './shared';
import { DEFAULT_PICKUP_LOCATIONS, DEFAULT_SHIPPING_METHODS, PAYMENT_METHODS, PRODUCTS } from './sources';

const ASSETS_DIR = path.join(__dirname, '../../core/mock-data/assets');

export async function populateDefaultChannel(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const zoneService = app.get(ZoneService);
    const ctxService = app.get(RequestContextService);
    const conn = app.get(TransactionalConnection);
    const defaultChannel = await channelService.getDefaultChannel();

    // 1. 先用初始 ctx 更新 default Channel 的字段
    await withCtx(app, defaultChannel, async ctx => {
        const zones = await zoneService.findAll(ctx);
        const asiaZone = zones.items.find(z => z.name === 'Asia');
        if (!asiaZone) throw new Error('Asia zone not found');

        await channelService.update(ctx, {
            id: defaultChannel.id as string,
            token: 'default-token',
            defaultCurrencyCode: CurrencyCode.CNY,
            availableCurrencyCodes: [CurrencyCode.CNY],
            defaultLanguageCode: LanguageCode.zh_Hans,
            availableLanguageCodes: [LanguageCode.zh_Hans, LanguageCode.en],
            defaultTaxZoneId: asiaZone.id,
            defaultShippingZoneId: asiaZone.id,
            customFields: {
                couponStackable: false,
                maxStackableCount: null,
                employeePickupMode: 'loose',
                defaultLocation: { lat: 43.526210, lng: 125.664780 },
                authConfig: {
                    enabledMethods: ['native', 'phone', 'wechat', 'alipay', 'douyin'],
                    overridesJson: '',
                    ssoProvidersJson: '',
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
        } as any);
    }

    // 3. 用 token 字符串构造 ctx，强制从刷新后的缓存重新获取 Channel（含 defaultTaxZone 关系）
    const superAdmin = await getSuperAdminUser(app);
    const freshCtx = await ctxService.create({
        apiType: 'admin',
        channelOrToken: defaultChannel.token || '__default_channel__',
        user: superAdmin,
    });

    // 验证 taxZone 已加载
    if (!freshCtx.channel.defaultTaxZone) {
        // 如果 token 方式仍然拿不到 taxZone，直接用 findOne 手动加载
        const freshChannel = await channelService.findOne(freshCtx, defaultChannel.id as string);
        if (freshChannel?.defaultTaxZone) {
            const ctx2 = await ctxService.create({ apiType: 'admin', channelOrToken: freshChannel });
            await createProducts(app, ctx2);
            await createShippingMethods(app, ctx2);
            await createPaymentMethods(app, ctx2);
            await createPickupLocations(app, ctx2);
            await createRoles(app, ctx2, defaultChannel.id as ID);
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
    await createRoles(app, freshCtx, defaultChannel.id as ID);
    await createEmployeeCustomers(app, freshCtx);
}

async function createProducts(app: INestApplication, ctx: RequestContext): Promise<void> {
    const productService = app.get(ProductService);
    const productVariantService = app.get(ProductVariantService);
    const facetService = app.get(FacetService);
    const assetService = app.get(AssetService);
    const taxCategoryService = app.get(TaxCategoryService);
    const stockMovementService = app.get(StockMovementService);
    const optionGroupService = app.get(ProductOptionGroupService);
    const optionService = app.get(ProductOptionService);

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

        // 多变体商品需创建 ProductOptionGroup（Vendure 不允许同 Product 下多个无选项的 Variant）
        let optionIds: string[] = [];
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
                optionIds.push(opt.id as string);
            }
        }

        // 创建 ProductVariant（多变体商品需传 optionIds）
        const createdVariants = await productVariantService.create(
            ctx,
            p.variants.map((v, i) => ({
                productId: product.id,
                sku: v.sku,
                translations: [{ languageCode: ctx.languageCode, name: v.name }],
                price: yuanToCents(v.price),
                taxCategoryId: standardTax.id as string,
                optionIds: optionIds.length > 0 ? [optionIds[i]] : undefined,
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
            coordinates: loc.coordinates,
            isPublic: (loc as any).isPublic ?? false,
        } as any);
    }
}

// TenantAdmin 权限：本 channel 全权（不含 SuperAdmin），加自提点/EmployeeCustomer 全部权限
const TENANT_ADMIN_PERMISSIONS: Permission[] = [
    Permission.Authenticated,
    Permission.Owner,
    Permission.ReadOrder,
    Permission.UpdateOrder,
    Permission.CreateCustomer,
    Permission.ReadCustomer,
    Permission.UpdateCustomer,
    PickupPermissions.ReadPickupLocation as Permission,
    PickupPermissions.CreatePickupLocation as Permission,
    PickupPermissions.UpdatePickupLocation as Permission,
    PickupPermissions.DeletePickupLocation as Permission,
    PickupPermissions.AssignPickupLocation as Permission,
    PickupPermissions.ReadEmployeeCustomer as Permission,
    PickupPermissions.CreateEmployeeCustomer as Permission,
    PickupPermissions.UpdateEmployeeCustomer as Permission,
    PickupPermissions.DeleteEmployeeCustomer as Permission,
    PickupPermissions.BindPickupLocation as Permission,
    PickupPermissions.VerifyEmployeeCustomer as Permission,
];

// SalesPerson 权限：只读自提点 + 创建 EmployeeCustomer（不允许 Verify）
const SALES_PERSON_PERMISSIONS: Permission[] = [
    Permission.Authenticated,
    Permission.Owner,
    Permission.ReadOrder,
    Permission.ReadCustomer,
    PickupPermissions.ReadPickupLocation as Permission,
    PickupPermissions.ReadEmployeeCustomer as Permission,
    PickupPermissions.CreateEmployeeCustomer as Permission,
];

async function createRoles(app: INestApplication, ctx: RequestContext, channelId: ID): Promise<void> {
    const roleService = app.get(RoleService);
    try {
        await roleService.create(ctx, {
            code: 'tenant-admin',
            description: '租户管理员',
            permissions: TENANT_ADMIN_PERMISSIONS,
            channelIds: [channelId],
        });
    } catch (e: any) {
        console.warn(`[populate] tenant-admin role creation skipped: ${e.message}`);
    }
    try {
        await roleService.create(ctx, {
            code: 'sales-person',
            description: '销售人员',
            permissions: SALES_PERSON_PERMISSIONS,
            channelIds: [channelId],
        });
    } catch (e: any) {
        console.warn(`[populate] sales-person role creation skipped: ${e.message}`);
    }
}

async function createEmployeeCustomers(app: INestApplication, ctx: RequestContext): Promise<void> {
    const employeeCustomerService = app.get(EmployeeCustomerService);
    const customerService = app.get(CustomerService);
    const pickupLocationService = app.get(PickupLocationService);

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
            verified: false,  // default channel 是 loose 模式，verified=false 即可
        } as any);
    } catch (e: any) {
        console.warn(`[populate] EmployeeCustomer binding skipped: ${e.message}`);
    }
}
