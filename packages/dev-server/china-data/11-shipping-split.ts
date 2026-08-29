import { INestApplication } from '@nestjs/common';
import { PaymentProfileService, ShippingProfileService } from '@vendure/cjk-plugin';
import {
    ChannelService,
    CurrencyCode,
    LanguageCode,
    PaymentMethodService,
    ProductService,
    ProductVariantService,
    RequestContext,
    RoleService,
    ShippingMethodService,
    StockLocation,
    StockLocationService,
    ZoneService,
} from '@vendure/core';

import { withCtx, createAdminCtx } from './shared';
import { DEFAULT_SHIPPING_METHODS, PAYMENT_METHODS } from './sources';

/**
 * 拆单测试种子（阶段 11）。
 *
 * 目标：提供 2 个租户渠道（shop-a / shop-b）各自的「配送档案 + 支付档案」与「不同配送方式」，
 * 使在前端/后端触发 checkoutSplitted 时能够稳定的「拆单」。
 *
 * 拆单机制（对齐 order-box-aggregation.decideAggregation）：
 * - 订单按变体 customFields.shippingProfileId（已生效配送档案）分箱；
 * - 每箱可用支付方式 = 其配送档案绑定支付档案的支付方式集合；
 * - 用户选非余额方式 M 时：支持 M 的箱合入同订单，缺 M 的箱拆出独立订单。
 * 因 box.tenantChannelId 取自订单渠道（marketplace 单一默认渠道），跨租户体现在「不同配送方式 + 不同支付档案」，
 * 选货到付款时 shop-b 预付箱缺该方式 → 拆出独立订单 → orderCount=2。
 *
 * 数据布局：
 * - shop-a（已建渠道，本阶段补配）：
 *     配送方式: 顺丰特快 + 中通  |  标准支付[测试支付,货到付款] · 仅预付[测试支付]
 *     标准配档(默认) ↔ 预付配档
 *     NF-RICE-5KG → 标准配档（支持货到付款）
 * - shop-b（本阶段新建）：
 *     配送方式: 京东物流 + 德邦  |  标准支付[测试支付,货到付款] · 仅预付[测试支付]
 *     标准配档(默认) ↔ 预付配档
 *     HW-ROUTER-STD → 预付配档（不支持货到付款）
 *
 * 验证方式：默认渠道购物车同时加入 NF-RICE-5KG 与 HW-ROUTER-STD，选「货到付款」提交，
 * 应拆出 2 个独立订单（NF-RICE 单走顺丰/中通，HW-ROUTER 单走京东物流）。
 */
interface SplitTenantConfig {
    channelCode: string;
    ensureShipping: string[];
    ensurePayment: string[];
    standard: {
        code: string;
        name: string;
        description: string;
        shipping: string[];
    };
    prepay: {
        code: string;
        name: string;
        description: string;
        shipping: string[];
    };
    /** 标准支付档案所含支付方式 code 列表 */
    standardProfilePayMethods: string[];
    /** 预付支付档案所含支付方式 code 列表（应少于标准，用于触发拆单） */
    prepayProfilePayMethods: string[];
    assign: Array<{ sku: string; profile: 'standard' | 'prepay' }>;
}

export async function populateShippingSplit(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const defaultChannel = await channelService.getDefaultChannel();

    // 1. 新建 shop-b 渠道（若已存在则跳过）
    await createShopBChannel(app);

    const allChannels = await channelService.findAll(await createAdminCtx(app, defaultChannel));
    const shopA = allChannels.items.find(c => c.code === 'shop-a');
    const shopB = allChannels.items.find(c => c.code === 'shop-b');
    if (!shopA) throw new Error('shop-a channel not found');
    if (!shopB) throw new Error('shop-b channel not found');

    // 2. 为两租户配置配送方式 / 配送档案 / 支付档案
    const shopAProfiles = await configureTenant(app, shopA, SHOP_A_SPLIT);
    const shopBProfiles = await configureTenant(app, shopB, SHOP_B_SPLIT);

    // 3. 把测试变体绑定到对应配送档案（触发分箱 + 拆单）
    await assignCartVariants(app, defaultChannel, [
        ...SHOP_A_SPLIT.assign.map(a => ({ sku: a.sku, profileId: shopAProfiles[a.profile]!.id })),
        ...SHOP_B_SPLIT.assign.map(a => ({ sku: a.sku, profileId: shopBProfiles[a.profile]!.id })),
    ]);
}

async function createShopBChannel(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const zoneService = app.get(ZoneService);
    const defaultChannel = await channelService.getDefaultChannel();

    const existing = (await channelService.findAll(await createAdminCtx(app, defaultChannel)))
        .items.find(c => c.code === 'shop-b');
    if (existing) return;

    // 创建渠道
    await withCtx(app, defaultChannel, async ctx => {
        const asiaZone = (await zoneService.findAll(ctx)).items.find(z => z.name === 'Asia');
        if (!asiaZone) throw new Error('Asia zone not found');
        await channelService.create(ctx, {
            code: 'shop-b',
            token: 'shop-b-token',
            defaultCurrencyCode: CurrencyCode.CNY,
            availableCurrencyCodes: [CurrencyCode.CNY],
            defaultLanguageCode: LanguageCode.zh_Hans,
            availableLanguageCodes: [LanguageCode.zh_Hans],
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

    const shopB = (await channelService.findAll(await createAdminCtx(app, defaultChannel)))
        .items.find(c => c.code === 'shop-b');
    if (!shopB) throw new Error('shop-b channel not found after creation');

    // 角色关联：仅需补 customer。superadmin 角色由 CJKPlugin 在 ChannelEvent('created') 时自动覆盖新渠道
    // （plugin.ts 订阅），此处若再 assignRoleToChannel 超管角色会重复插入 role_channels_channel（复合主键）触发冲突。
    const roleService = app.get(RoleService);
    const adminCtx = await createAdminCtx(app, defaultChannel);
    await roleService.assignRoleToChannel(adminCtx, (await roleService.getCustomerRole(adminCtx)).id, shopB.id);

    // 共享默认库存地点，避免 shop-b 下单库存检查失败
    const stockLocationService = app.get(StockLocationService);
    const defaultStockLocation = await stockLocationService.defaultStockLocation(adminCtx);
    if (defaultStockLocation) {
        await channelService.assignToChannels(adminCtx, StockLocation, defaultStockLocation.id, [shopB.id]);
    }

    // 商品分配到 shop-b
    await withCtx(app, defaultChannel, async ctx => {
        const productService = app.get(ProductService);
        const products = await productService.findAll(ctx, { take: 999 });
        await productService.assignProductsToChannel(ctx, {
            channelId: shopB.id,
            productIds: products.items.map(p => p.id as string),
        });
    });
}

async function configureTenant(
    app: INestApplication,
    channel: any,
    cfg: SplitTenantConfig,
): Promise<{ standard: { id: any } | undefined; prepay: { id: any } | undefined }> {
    const result: { standard: { id: any } | undefined; prepay: { id: any } | undefined } = {
        standard: undefined,
        prepay: undefined,
    };
    await withCtx(app, channel as any, async ctx => {
        // 1. 补齐配送方式（缺失才建，避免与既有重复）
        await ensureShippingMethods(app, ctx, cfg.ensureShipping);
        // 2. 补齐支付方式（shop-b 需自建；shop-a 已有则跳过）
        await ensurePaymentMethods(app, ctx, cfg.ensurePayment);

        const smByCode = idMap((await app.get(ShippingMethodService).findAll(ctx, { take: 999 })).items, 'code');
        const pmByCode = idMap((await app.get(PaymentMethodService).findAll(ctx, { take: 999 })).items, 'code');

        // 3. 支付档案：标准[支付含货到付款] / 仅预付[仅测试支付]
        const paymentProfileService = app.get(PaymentProfileService);
        const stdPay = await paymentProfileService.create(ctx, {
            name: `${cfg.channelCode} 标准支付`,
            description: '含测试支付与货到付款',
            code: `${cfg.channelCode}-pay-standard`,
            isGlobal: false,
            paymentMethodIds: cfg.standardProfilePayMethods.map(c => pmByCode.get(c)!),
        });
        const prepayPay = await paymentProfileService.create(ctx, {
            name: `${cfg.channelCode} 仅预付`,
            description: '仅支持测试支付（不支持货到付款，用于拆单验证）',
            code: `${cfg.channelCode}-pay-prepay`,
            isGlobal: false,
            paymentMethodIds: cfg.prepayProfilePayMethods.map(c => pmByCode.get(c)!),
        });

        // 4. 配送档案：标准配档(默认) / 预付配档
        const shippingProfileService = app.get(ShippingProfileService);
        const standardProfile = await shippingProfileService.create(ctx, {
            name: cfg.standard.name,
            description: cfg.standard.description,
            code: cfg.standard.code,
            isGlobal: false,
            shippingMethodIds: cfg.standard.shipping.map(c => smByCode.get(c)!),
            paymentProfileId: stdPay.id,
        });
        await shippingProfileService.setTenantDefault(ctx, standardProfile.id);
        result.standard = { id: standardProfile.id };

        const prepayProfile = await shippingProfileService.create(ctx, {
            name: cfg.prepay.name,
            description: cfg.prepay.description,
            code: cfg.prepay.code,
            isGlobal: false,
            shippingMethodIds: cfg.prepay.shipping.map(c => smByCode.get(c)!),
            paymentProfileId: prepayPay.id,
        });
        result.prepay = { id: prepayProfile.id };
    });
    return result;
}

async function ensureShippingMethods(
    app: INestApplication,
    ctx: RequestContext,
    codes: string[],
): Promise<void> {
    const shippingMethodService = app.get(ShippingMethodService);
    const existing = new Set((await shippingMethodService.findAll(ctx, { take: 999 })).items.map(m => (m as any).code));
    for (const code of codes) {
        if (existing.has(code)) continue;
        const src = DEFAULT_SHIPPING_METHODS.find(m => m.code === code);
        if (!src) throw new Error(`配送方式模板缺失: ${code}`);
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

async function ensurePaymentMethods(
    app: INestApplication,
    ctx: RequestContext,
    codes: string[],
): Promise<void> {
    if (codes.length === 0) return;
    const paymentMethodService = app.get(PaymentMethodService);
    const existing = new Set((await paymentMethodService.findAll(ctx, { take: 999 })).items.map(pm => (pm as any).code));
    for (const code of codes) {
        if (existing.has(code)) continue;
        const src = PAYMENT_METHODS.find(pm => pm.code === code);
        if (!src) throw new Error(`支付方式模板缺失: ${code}`);
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

async function assignCartVariants(
    app: INestApplication,
    defaultChannel: any,
    assigns: Array<{ sku: string; profileId: any }>,
): Promise<void> {
    const productVariantService = app.get(ProductVariantService);
    await withCtx(app, defaultChannel as any, async ctx => {
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

function idMap(items: any[], key: string): Map<string, any> {
    return new Map(items.map(it => [String((it as any)[key]), (it as any).id]));
}

// ===== 两租户配置 =====

const SHOP_A_SPLIT: SplitTenantConfig = {
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

const SHOP_B_SPLIT: SplitTenantConfig = {
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