"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMarketplaceE2E = runMarketplaceE2E;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dev_config_1 = require("./dev-config");
const china_data_1 = require("./china-data");
const shared_1 = require("./china-data/shared");
// marketplace 服务类从包入口导入，与插件 providers 使用同一类 token，app.get() 才能命中
const marketplace_plugin_1 = require("@vendure/marketplace-plugin");
const marketplace_plugin_2 = require("@vendure/marketplace-plugin");
const marketplace_plugin_3 = require("@vendure/marketplace-plugin");
let passCount = 0;
let failCount = 0;
const failedMsgs = [];
function expect(cond, msg) {
    if (cond) {
        passCount++;
        console.log(`  ✓ ${msg}`);
    }
    else {
        failCount++;
        failedMsgs.push(msg);
        console.error(`  ✗ ${msg}`);
    }
}
async function clearPluginTables() {
    // sqlite 模式：直接删除数据库文件，bootstrap 时 synchronize:true 会重建所有表（含插件表）。
    // 避免 clearAllTables 对 sqlite 的 timestamp 类型不兼容。
    const opts = dev_config_1.devConfig.dbConnectionOptions;
    if (opts.type === 'better-sqlite3' && opts.database) {
        const dbFile = String(opts.database);
        for (const suffix of ['', '-shm', '-wal']) {
            const f = fs_1.default.existsSync(dbFile + suffix) ? dbFile + suffix : dbFile;
            if (fs_1.default.existsSync(f)) {
                fs_1.default.rmSync(f, { force: true });
                console.log(`已删除 sqlite 文件: ${path_1.default.basename(f)}`);
            }
        }
        return;
    }
    // 非 sqlite：退化为清空插件表
    const dataSource = new typeorm_1.DataSource({
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
    }
    catch (e) {
        console.warn(`清空 customer_balance 跳过: ${e.message}`);
    }
    await dataSource.destroy();
}
async function runMarketplaceE2E(app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const deps = {
        channelService: app.get(core_1.ChannelService),
        customerService: app.get(core_1.CustomerService),
        orderService: app.get(core_1.OrderService),
        variantService: app.get(core_1.ProductVariantService),
        shippingMethodService: app.get(core_1.ShippingMethodService),
        paymentMethodService: app.get(core_1.PaymentMethodService),
        productService: app.get(core_1.ProductService),
        stockMovementService: app.get(core_1.StockMovementService),
        conn: app.get(core_1.TransactionalConnection),
        ctxService: app.get(core_1.RequestContextService),
        marketplaceService: app.get(marketplace_plugin_1.MarketplaceService),
        sellerService: app.get(marketplace_plugin_2.MarketplaceSellerService),
        settlementService: app.get(marketplace_plugin_3.SettlementService),
    };
    const defaultChannel = await deps.channelService.getDefaultChannel();
    const adminCtx = await (0, shared_1.createAdminCtx)(app, defaultChannel);
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
    expect(!!(merchantChannel === null || merchantChannel === void 0 ? void 0 : merchantChannel.id), `商家渠道已创建: code=${merchantChannel === null || merchantChannel === void 0 ? void 0 : merchantChannel.code}`);
    expect(merchantChannel.sellerId != null, `关联 Seller: sellerId=${merchantChannel.sellerId}`);
    // ============ 2. 商家渠道补配支付方式（逐单支付前置条件） ============
    console.log('\n[2] 商家渠道补配 dummy-payment');
    const paymentMethods = await deps.paymentMethodService.findAll(adminCtx);
    const dummyPayment = paymentMethods.items.find(pm => pm.code === 'dummy-payment');
    if (dummyPayment) {
        await deps.channelService.assignToChannels(adminCtx, core_1.PaymentMethod, dummyPayment.id, [merchantChannel.id]);
        expect(true, `dummy-payment(id=${dummyPayment.id}) 已挂到商家渠道`);
    }
    else {
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
    const variant = (_c = (_b = (_a = (await deps.productService.findOne(adminCtx, product.id, ['variants']))) === null || _a === void 0 ? void 0 : _a.variants) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : (await createSingleVariant(deps, adminCtx, product.id));
    expect(!!(variant === null || variant === void 0 ? void 0 : variant.id), `商品已创建: sku=${(_d = variant === null || variant === void 0 ? void 0 : variant.sku) !== null && _d !== void 0 ? _d : '(待创建)'}`);
    // 商品 + 变体挂到商家渠道（使变体恰好属于 default + 商家 2 个渠道）
    await deps.channelService.assignToChannels(adminCtx, core_1.Product, product.id, [merchantChannel.id]);
    await deps.channelService.assignToChannels(adminCtx, core_1.ProductVariant, variant.id, [merchantChannel.id]);
    // 为商家变体设置库存（参考 china-data/02-default-channel.ts），否则下单时 INSUFFICIENT_STOCK_ERROR
    await deps.stockMovementService.adjustProductVariantStock(adminCtx, variant.id, 100);
    expect(true, `商家变体(sku=${variant === null || variant === void 0 ? void 0 : variant.sku})库存已设为 100`);
    // 校验变体恰好 2 渠道
    const loadedVariant = await deps.variantService.findOne(adminCtx, variant.id, ['channels']);
    const channelCount = (_f = (_e = loadedVariant === null || loadedVariant === void 0 ? void 0 : loadedVariant.channels) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0;
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
    expect(((_g = shown === null || shown === void 0 ? void 0 : shown.customFields) === null || _g === void 0 ? void 0 : _g.listedInMarketplace) === true, 'listedInMarketplace=true');
    expect(((_h = shown === null || shown === void 0 ? void 0 : shown.customFields) === null || _h === void 0 ? void 0 : _h.merchantRef) != null, `merchantRef 指向商家渠道: ${(_l = (_k = (_j = shown === null || shown === void 0 ? void 0 : shown.customFields) === null || _j === void 0 ? void 0 : _j.merchantRef) === null || _k === void 0 ? void 0 : _k.code) !== null && _l !== void 0 ? _l : 'null'}`);
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
    if (!((_m = fullCustomer === null || fullCustomer === void 0 ? void 0 : fullCustomer.user) === null || _m === void 0 ? void 0 : _m.id)) {
        expect(false, '客户无 user（无法下单）');
        return;
    }
    // 5.2 建单并加自营 + 商家商品
    const order = await deps.orderService.create(adminCtx, fullCustomer.user.id);
    const selfVariant = (await deps.variantService.findAll(adminCtx, { filter: { sku: { eq: 'NF-WATER-500' } }, take: 1 })).items[0];
    expect(!!selfVariant, '自营商品变体 NF-WATER-500 存在');
    const addSelf = await deps.orderService.addItemToOrder(adminCtx, order.id, selfVariant.id, 3);
    expect(!(0, core_1.isGraphQlErrorResult)(addSelf), '加入自营商品成功');
    const addMkt = await deps.orderService.addItemToOrder(adminCtx, order.id, variant.id, 2);
    if ((0, core_1.isGraphQlErrorResult)(addMkt)) {
        console.error(`    addMkt 错误: ${(_o = addMkt.message) !== null && _o !== void 0 ? _o : '未知'}`);
    }
    expect(!(0, core_1.isGraphQlErrorResult)(addMkt), '加入商家商品成功');
    // 5.3 设置配送地址 + 配送方式
    const defaultAddress = (_p = fullCustomer.addresses) === null || _p === void 0 ? void 0 : _p[0];
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
        expect(!(0, core_1.isGraphQlErrorResult)(setShip), '设置配送方式 sf-express 成功');
    }
    else {
        expect(false, '未找到 sf-express 配送方式');
    }
    // 5.4 转换到 ArrangingPayment
    const toArranging = await deps.orderService.transitionToState(adminCtx, order.id, 'ArrangingPayment');
    expect(!(0, core_1.isGraphQlErrorResult)(toArranging), `订单已到 ArrangingPayment`);
    // ============ 6. 支付触发分单 ============
    console.log('\n[6] 支付聚合订单 → 触发分单');
    const paymentInput = { method: 'dummy-payment', metadata: {} };
    const payResult = await deps.conn.withTransaction(adminCtx, async (txCtx) => {
        return deps.orderService.addPaymentToOrder(txCtx, order.id, paymentInput);
    });
    expect(!(0, core_1.isGraphQlErrorResult)(payResult), '聚合订单支付成功');
    // 6.1 获取分出的商家子单
    const aggregate = await deps.orderService.findOne(adminCtx, order.id);
    expect(!!aggregate, '聚合订单仍可查询');
    if (!aggregate) {
        return;
    }
    const sellerOrders = await deps.orderService.getSellerOrders(adminCtx, aggregate);
    expect(sellerOrders.length > 0, `分单产生 ${sellerOrders.length} 个商家子单`);
    // 按渠道归属选择当前商家(test-shop)的子单，而非按 saleSource（自购商品如归属 shop-a 也会生成子单）
    const merchantSellerOrder = sellerOrders.find(so => { var _a; return (_a = so.channels) === null || _a === void 0 ? void 0 : _a.some((c) => `${c.id}` === `${merchantChannel.id}`); });
    expect(!!merchantSellerOrder, `商家子单归属商家渠道 ${merchantChannel.code}`);
    expect(!merchantSellerOrder || ((_q = merchantSellerOrder.customFields) === null || _q === void 0 ? void 0 : _q.saleSource) === 'marketplace', '商家子单 saleSource=marketplace');
    // ============ 7. 逐单支付商家子单 ============
    console.log('\n[7] 逐单支付商家子单');
    const customerUser = fullCustomer.user;
    const customerCtx = await deps.ctxService.create({
        apiType: 'shop',
        channelOrToken: defaultChannel,
        user: customerUser,
    });
    if (merchantSellerOrder) {
        const sellerPay = await deps.conn.withTransaction(customerCtx, async (txCtx) => {
            return deps.orderService.addPaymentToOrder(txCtx, merchantSellerOrder.id, paymentInput);
        });
        expect(!(0, core_1.isGraphQlErrorResult)(sellerPay), `商家子单(code=${merchantSellerOrder.code})逐单支付成功`);
    }
    // ============ 8. 商家订单查询 + 对账 ============
    console.log('\n[8] 商家订单查询 + 对账导出');
    const merchantOrders = await deps.settlementService.listMerchantOrders(adminCtx, merchantChannel.id);
    expect(merchantOrders.length > 0, `商家渠道订单查询命中 ${merchantOrders.length} 单`);
    const found = merchantOrders.find(o => { var _a; return ((_a = o.customFields) === null || _a === void 0 ? void 0 : _a.saleSource) === 'marketplace'; });
    expect(!!found, '命中订单为 marketplace 销售来源');
    const settlement = await deps.settlementService.exportMerchantSettlement(adminCtx, merchantChannel.id);
    expect(settlement.length > 0, `对账导出命中 ${settlement.length} 单`);
    const inSettlement = settlement.find(e => `${e.orderId}` === `${merchantSellerOrder === null || merchantSellerOrder === void 0 ? void 0 : merchantSellerOrder.id}`);
    expect(!!inSettlement, `对账包含商家子单, state=${inSettlement === null || inSettlement === void 0 ? void 0 : inSettlement.state}`);
}
async function createSingleVariant(deps, ctx, productId) {
    const variants = await deps.variantService.create(ctx, [
        {
            productId,
            sku: `MKT-TEST-001-${Date.now() % 100000}`,
            translations: [{ languageCode: ctx.languageCode, name: '商家测试规格' }],
            price: (0, china_data_1.yuanToCents)(88),
            // taxCategoryId 省略，Vendure 会自动为变体选择税率分类
        },
    ]);
    return variants[0];
}
/**
 * 确保测试客户 zhangsan@test.cn 存在（含 user + 默认收货地址）。
 * 不使用 china-data/populateCustomers（其内嵌 PG 原生 SQL 的 $1/NOW()，sqlite 不兼容）。
 */
async function ensureCustomer(deps, adminCtx) {
    const { customerService } = deps;
    const existing = await customerService.findAll(adminCtx, {
        filter: { emailAddress: { eq: 'zhangsan@test.cn' } },
        take: 1,
    });
    if (existing.items[0]) {
        return existing.items[0];
    }
    const created = await customerService.create(adminCtx, {
        firstName: '三',
        lastName: '张',
        phoneNumber: '13800138001',
        emailAddress: 'zhangsan@test.cn',
    }, 'test');
    if ((0, core_1.isGraphQlErrorResult)(created)) {
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
        .then(() => (0, core_1.bootstrap)(dev_config_1.devConfig))
        .then(async (app) => {
        const logger = app.get(core_1.JobQueueService);
        await logger.start();
        const t0 = Date.now();
        // 基础数据：superadmin + default 渠道商品/配送/支付 + shop-a 渠道（客户在测试内按需创建，避免 PG 原生 SQL 的 sqlite 兼容问题）
        await (0, china_data_1.populateBase)(app);
        await (0, china_data_1.populateDefaultChannel)(app);
        await (0, china_data_1.populateShopAChannel)(app);
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
        }
        else {
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
//# sourceMappingURL=e2e-marketplace-test.js.map