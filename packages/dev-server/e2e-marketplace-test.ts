/* eslint-disable no-console */
/**
 * marketplace 全链路端到端测试（进程内 bootstrap + sqlite，直接调服务层接口并断言）。
 *
 * 覆盖链路：
 *   商家入驻 → 商家商品创建(挂 default+商家双渠道) → 商品上架提交 → 平台审批
 *   → 跨商家聚合下单 → 支付触发分单 → 逐单支付商家子单 → 商家订单查询 → 对账导出
 *
 * 运行环境：DB=sqlite（不依赖外部 MySQL）
 *   DB=sqlite npm run e2e:marketplace
 *
 * 关键实现细节（参考代码核实）：
 *   1. MarketplaceSellerStrategy.setOrderLineSellerChannel 要求商家商品变体恰好在 2 个渠道
 *      （default + 商家渠道），否则不分单。故创建商品后需 assignToChannels 挂到商家渠道。
 *   2. 分单发生在 ArrangingPayment → PaymentAuthorized/PaymentSettled（shouldSetAsPlaced=true）。
 *   3. 商家渠道默认无支付方式，需补配 dummy-payment，否则逐单支付 addPaymentToOrder 失败。
 *   4. SettlementService.exportMerchantSettlement 未被 GraphQL 暴露，只能服务层直接调用。
 */
import { INestApplication, Logger } from '@nestjs/common';
import { PaymentInput } from '@vendure/common/lib/generated-shop-types';
import {
    bootstrap,
    Channel,
    ChannelService,
    CustomerService,
    isGraphQlErrorResult,
    JobQueueService,
    OrderService,
    PaymentMethod,
    PaymentMethodService,
    Product,
    ProductService,
    ProductVariant,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    ShippingMethodService,
    StockMovementService,
    TransactionalConnection,
    User,
} from '@vendure/core';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';

import { devConfig } from './dev-config';
import {
    populateBase,
    populateDefaultChannel,
    populateShopAChannel,
    yuanToCents,
} from './china-data';
import { createAdminCtx } from './china-data/shared';
// marketplace 服务类从包入口导入，与插件 providers 使用同一类 token，app.get() 才能命中
import { MarketplaceService } from '@vendure/marketplace-plugin';
import { MarketplaceSellerService } from '@vendure/marketplace-plugin';
import { SettlementService } from '@vendure/marketplace-plugin';

let passCount = 0;
let failCount = 0;
const failedMsgs: string[] = [];

function expect(cond: boolean, msg: string): void {
    if (cond) {
        passCount++;
        console.log(`  ✓ ${msg}`);
    } else {
        failCount++;
        failedMsgs.push(msg);
        console.error(`  ✗ ${msg}`);
    }
}

async function clearPluginTables(): Promise<void> {
    // sqlite 模式：直接删除数据库文件，bootstrap 时 synchronize:true 会重建所有表（含插件表）。
    // 避免 clearAllTables 对 sqlite 的 timestamp 类型不兼容。
    const opts = devConfig.dbConnectionOptions as any;
    if (opts.type === 'better-sqlite3' && opts.database) {
        const dbFile = String(opts.database);
        for (const suffix of ['', '-shm', '-wal']) {
            const f = fs.existsSync(dbFile + suffix) ? dbFile + suffix : dbFile;
            if (fs.existsSync(f)) {
                fs.rmSync(f, { force: true });
                console.log(`已删除 sqlite 文件: ${path.basename(f)}`);
            }
        }
        return;
    }
    // 非 sqlite：退化为清空插件表
    const dataSource = new DataSource({
        type: opts.type,
        host: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        database: opts.database,
        schema: opts.schema,
        synchronize: false,
        entities: [],
        migrations: [],
    });
    await dataSource.initialize();
    try {
        await dataSource.query('DELETE FROM customer_balance');
    } catch (e: any) {
        console.warn(`清空 customer_balance 跳过: ${e.message}`);
    }
    await dataSource.destroy();
}

interface MarketplaceDeps {
    channelService: ChannelService;
    customerService: CustomerService;
    orderService: OrderService;
    variantService: ProductVariantService;
    shippingMethodService: ShippingMethodService;
    paymentMethodService: PaymentMethodService;
    productService: ProductService;
    stockMovementService: StockMovementService;
    conn: TransactionalConnection;
    ctxService: RequestContextService;
    marketplaceService: MarketplaceService;
    sellerService: MarketplaceSellerService;
    settlementService: SettlementService;
}

export async function runMarketplaceE2E(app: INestApplication): Promise<void> {
    const deps: MarketplaceDeps = {
        channelService: app.get(ChannelService),
        customerService: app.get(CustomerService),
        orderService: app.get(OrderService),
        variantService: app.get(ProductVariantService),
        shippingMethodService: app.get(ShippingMethodService),
        paymentMethodService: app.get(PaymentMethodService),
        productService: app.get(ProductService),
        stockMovementService: app.get(StockMovementService),
        conn: app.get(TransactionalConnection),
        ctxService: app.get(RequestContextService),
        marketplaceService: app.get(MarketplaceService),
        sellerService: app.get(MarketplaceSellerService),
        settlementService: app.get(SettlementService),
    };

    const defaultChannel = await deps.channelService.getDefaultChannel();
    const adminCtx = await createAdminCtx(app, defaultChannel);

    // ============ 0. 准备测试客户 zhangsan（含 user + 地址，便于建单） ============
    console.log('\n[0] 准备测试客户');
    await ensureCustomer(deps, adminCtx);

    // ============ 1. 商家入驻 ============
    console.log('\n[1] 商家入驻');
    const merchantChannel = await deps.sellerService.registerMarketplaceSeller(adminCtx, {
        shopName: 'Test-Shop',
        seller: {
            firstName: '测',
            lastName: '商',
            emailAddress: 'merchant@test.cn',
            password: 'test',
        },
    });
    expect(!!merchantChannel?.id, `商家渠道已创建: code=${merchantChannel?.code}`);
    expect(merchantChannel.sellerId != null, `关联 Seller: sellerId=${merchantChannel.sellerId}`);

    // ============ 2. 商家渠道补配支付方式（逐单支付前置条件） ============
    console.log('\n[2] 商家渠道补配 dummy-payment');
    const paymentMethods = await deps.paymentMethodService.findAll(adminCtx);
    const dummyPayment = paymentMethods.items.find(pm => pm.code === 'dummy-payment');
    if (dummyPayment) {
        await deps.channelService.assignToChannels(adminCtx, PaymentMethod, dummyPayment.id, [merchantChannel.id]);
        expect(true, `dummy-payment(id=${dummyPayment.id}) 已挂到商家渠道`);
    } else {
        expect(false, '未找到 dummy-payment');
    }

    // ============ 3. 商家创建商品（挂 default + 商家 双渠道） ============
    console.log('\n[3] 商家创建商品');
    const product = await deps.productService.create(adminCtx, {
        translations: [
            {
                languageCode: adminCtx.languageCode,
                name: '商家测试商品',
                slug: `mkt-test-product-${Date.now() % 100000}`,
                description: 'marketplace E2E 测试商品',
            },
        ],
        customFields: {
            barcode: 'MKT-BARCODE-001',
            internalCode: 'MKT-INT-001',
        },
    });
    const variant = (await deps.productService.findOne(adminCtx, product.id, ['variants']))?.variants?.[0]
        ?? (await createSingleVariant(deps, adminCtx, product.id));
    expect(!!variant?.id, `商品已创建: sku=${variant?.sku ?? '(待创建)'}`);

    // 商品 + 变体挂到商家渠道（使变体恰好属于 default + 商家 2 个渠道）
    await deps.channelService.assignToChannels(adminCtx, Product, product.id, [merchantChannel.id]);
    await deps.channelService.assignToChannels(adminCtx, ProductVariant, variant.id, [merchantChannel.id]);

    // 为商家变体设置库存（参考 china-data/02-default-channel.ts），否则下单时 INSUFFICIENT_STOCK_ERROR
    await deps.stockMovementService.adjustProductVariantStock(adminCtx, variant.id, 100);
    expect(true, `商家变体(sku=${variant?.sku})库存已设为 100`);

    // 校验变体恰好 2 渠道
    const loadedVariant = await deps.variantService.findOne(adminCtx, variant.id, ['channels']);
    const channelCount = loadedVariant?.channels?.length ?? 0;
    expect(channelCount === 2, `变体渠道数=${channelCount}（期望 2，触发分单前提）`);

    // ============ 4. 上架提交 + 平台审批 ============
    console.log('\n[4] 商品上架提交 + 审批');
    await deps.marketplaceService.submitForMarketplace(adminCtx, product.id);
    const pending = (await deps.marketplaceService.getPendingProducts(adminCtx)).some(p => `${p.id}` === `${product.id}`);
    expect(pending, '提交后处于待审批(pending)');

    await deps.marketplaceService.approveMarketplaceProduct(adminCtx, product.id);
    const marketplaceProducts = await deps.marketplaceService.getMarketplaceProducts(adminCtx);
    const shown = marketplaceProducts.find(p => `${p.id}` === `${product.id}`);
    expect(!!shown, '审批通过后出现在 marketplace 商品列表');
    expect(shown?.customFields?.listedInMarketplace === true, 'listedInMarketplace=true');
    expect(shown?.customFields?.merchantRef != null, `merchantRef 指向商家渠道: ${(shown?.customFields?.merchantRef as any)?.code ?? 'null'}`);

    // ============ 5. 跨商家聚合下单 ============
    console.log('\n[5] 跨商家聚合下单（自营 + 商家商品）');
    // 5.1 找客户 zhangsan
    const customers = await deps.customerService.findAll(adminCtx, {
        filter: { emailAddress: { eq: 'zhangsan@test.cn' } },
        take: 1,
    });
    const customer = customers.items[0];
    expect(!!customer, `客户 zhangsan@test.cn 已就绪`);
    const fullCustomer = await deps.customerService.findOne(adminCtx, customer.id, ['user', 'addresses']);
    if (!fullCustomer?.user?.id) {
        expect(false, '客户无 user（无法下单）');
        return;
    }

    // 5.2 建单并加自营 + 商家商品
    const order = await deps.orderService.create(adminCtx, fullCustomer.user.id);
    const selfVariant = (
        await deps.variantService.findAll(adminCtx, { filter: { sku: { eq: 'NF-WATER-500' } }, take: 1 })
    ).items[0];
    expect(!!selfVariant, '自营商品变体 NF-WATER-500 存在');

    const addSelf = await deps.orderService.addItemToOrder(adminCtx, order.id, selfVariant.id, 3);
    expect(!isGraphQlErrorResult(addSelf), '加入自营商品成功');
    const addMkt = await deps.orderService.addItemToOrder(adminCtx, order.id, variant.id, 2);
    if (isGraphQlErrorResult(addMkt)) {
        console.error(`    addMkt 错误: ${(addMkt as any).message ?? '未知'}`);
    }
    expect(!isGraphQlErrorResult(addMkt), '加入商家商品成功');

    // 5.3 设置配送地址 + 配送方式
    const defaultAddress = fullCustomer.addresses?.[0];
    if (defaultAddress) {
        await deps.orderService.setShippingAddress(adminCtx, order.id, {
            fullName: `${fullCustomer.lastName}${fullCustomer.firstName}`,
            streetLine1: defaultAddress.streetLine1,
            city: defaultAddress.city,
            province: defaultAddress.province,
            postalCode: defaultAddress.postalCode,
            countryCode: 'CN',
        });
    }
    const shippingMethods = await deps.shippingMethodService.findAll(adminCtx);
    const sfExpress = shippingMethods.items.find(sm => sm.code === 'sf-express');
    if (sfExpress) {
        const setShip = await deps.orderService.setShippingMethod(adminCtx, order.id, [sfExpress.id]);
        expect(!isGraphQlErrorResult(setShip), '设置配送方式 sf-express 成功');
    } else {
        expect(false, '未找到 sf-express 配送方式');
    }

    // 5.4 转换到 ArrangingPayment
    const toArranging = await deps.orderService.transitionToState(adminCtx, order.id, 'ArrangingPayment');
    expect(!isGraphQlErrorResult(toArranging), `订单已到 ArrangingPayment`);

    // ============ 6. 支付触发分单 ============
    console.log('\n[6] 支付聚合订单 → 触发分单');
    const paymentInput: PaymentInput = { method: 'dummy-payment', metadata: {} };
    const payResult = await deps.conn.withTransaction(adminCtx, async txCtx => {
        return deps.orderService.addPaymentToOrder(txCtx, order.id, paymentInput);
    });
    expect(!isGraphQlErrorResult(payResult), '聚合订单支付成功');

    // 6.1 获取分出的商家子单
    const aggregate = await deps.orderService.findOne(adminCtx, order.id);
    expect(!!aggregate, '聚合订单仍可查询');
    if (!aggregate) {
        return;
    }
    const sellerOrders = await deps.orderService.getSellerOrders(adminCtx, aggregate);
    expect(sellerOrders.length > 0, `分单产生 ${sellerOrders.length} 个商家子单`);
    // 按渠道归属选择当前商家(test-shop)的子单，而非按 saleSource（自购商品如归属 shop-a 也会生成子单）
    const merchantSellerOrder = sellerOrders.find(so =>
        so.channels?.some((c: any) => `${c.id}` === `${merchantChannel.id}`),
    );
    expect(!!merchantSellerOrder, `商家子单归属商家渠道 ${merchantChannel.code}`);
    expect(
        !merchantSellerOrder || merchantSellerOrder.customFields?.saleSource === 'marketplace',
        '商家子单 saleSource=marketplace',
    );

    // ============ 7. 逐单支付商家子单 ============
    console.log('\n[7] 逐单支付商家子单');
    const customerUser = fullCustomer.user as unknown as User;
    const customerCtx = await deps.ctxService.create({
        apiType: 'shop',
        channelOrToken: defaultChannel,
        user: customerUser as any,
    });
    if (merchantSellerOrder) {
        const sellerPay = await deps.conn.withTransaction(customerCtx, async txCtx => {
            return deps.orderService.addPaymentToOrder(txCtx, merchantSellerOrder.id, paymentInput);
        });
        expect(!isGraphQlErrorResult(sellerPay), `商家子单(code=${merchantSellerOrder.code})逐单支付成功`);
    }

    // ============ 8. 商家订单查询 + 对账 ============
    console.log('\n[8] 商家订单查询 + 对账导出');
    const merchantOrders = await deps.settlementService.listMerchantOrders(adminCtx, merchantChannel.id);
    expect(merchantOrders.length > 0, `商家渠道订单查询命中 ${merchantOrders.length} 单`);
    const found = merchantOrders.find(o => o.customFields?.saleSource === 'marketplace');
    expect(!!found, '命中订单为 marketplace 销售来源');

    const settlement = await deps.settlementService.exportMerchantSettlement(adminCtx, merchantChannel.id);
    expect(settlement.length > 0, `对账导出命中 ${settlement.length} 单`);
    const inSettlement = settlement.find(e => `${e.orderId}` === `${merchantSellerOrder?.id}`);
    expect(!!inSettlement, `对账包含商家子单, state=${inSettlement?.state}`);
}

async function createSingleVariant(
    deps: Pick<MarketplaceDeps, 'variantService'>,
    ctx: RequestContext,
    productId: any,
): Promise<any> {
    const variants = await deps.variantService.create(ctx, [
        {
            productId,
            sku: `MKT-TEST-001-${Date.now() % 100000}`,
            translations: [{ languageCode: ctx.languageCode, name: '商家测试规格' }],
            price: yuanToCents(88),
            // taxCategoryId 省略，Vendure 会自动为变体选择税率分类
        },
    ]);
    return variants[0];
}

/**
 * 确保测试客户 zhangsan@test.cn 存在（含 user + 默认收货地址）。
 * 不使用 china-data/populateCustomers（其内嵌 PG 原生 SQL 的 $1/NOW()，sqlite 不兼容）。
 */
async function ensureCustomer(
    deps: Pick<MarketplaceDeps, 'customerService'>,
    adminCtx: RequestContext,
): Promise<any> {
    const { customerService } = deps;
    const existing = await customerService.findAll(adminCtx, {
        filter: { emailAddress: { eq: 'zhangsan@test.cn' } },
        take: 1,
    });
    if (existing.items[0]) {
        return existing.items[0];
    }
    const created = await customerService.create(
        adminCtx,
        {
            firstName: '三',
            lastName: '张',
            phoneNumber: '13800138001',
            emailAddress: 'zhangsan@test.cn',
        },
        'test',
    );
    if (isGraphQlErrorResult(created)) {
        throw new Error(`Failed to create customer zhangsan: ${created.message}`);
    }
    await customerService.createAddress(adminCtx, created.id, {
        fullName: '张三',
        streetLine1: '北京市海淀区中关村大街1号',
        city: '北京市',
        province: '北京市',
        postalCode: '100080',
        countryCode: 'CN',
        defaultShippingAddress: true,
        defaultBillingAddress: true,
    });
    expect(true, `测试客户 zhangsan@test.cn 已创建`);
    return created;
}

if (require.main === module) {
    clearPluginTables()
        .then(() => bootstrap(devConfig))
        .then(async app => {
            const logger = app.get(JobQueueService);
            await logger.start();
            const t0 = Date.now();
            // 基础数据：superadmin + default 渠道商品/配送/支付 + shop-a 渠道（客户在测试内按需创建，避免 PG 原生 SQL 的 sqlite 兼容问题）
            await populateBase(app);
            await populateDefaultChannel(app);
            await populateShopAChannel(app);
            console.log(`基础数据就绪 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
            await runMarketplaceE2E(app);
            await app.close();
        })
        .then(() => {
            console.log(`\n=== E2E 汇总 === 通过: ${passCount}, 失败: ${failCount}`);
            if (failCount > 0) {
                console.log('失败项:');
                failedMsgs.forEach(m => console.log(`  - ${m}`));
                process.exit(1);
            } else {
                console.log('✅ marketplace 全链路 E2E 全部通过');
                process.exit(0);
            }
        })
        .catch(err => {
            console.error('\n=== E2E 异常 ===');
            console.error(err);
            process.exit(1);
        });
}