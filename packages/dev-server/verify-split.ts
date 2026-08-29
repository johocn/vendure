/* eslint-disable no-console */
/**
 * 拆单实测脚本（进程内 bootstrap + 服务层调用，直接读取已跑完 populate:china 的 postgres 数据）。
 *
 * 链路：zhangsan 登录态建单 → 加入 NF-RICE-5KG(shop-a 标准配档,支持货到付款) 与 HW-ROUTER-STD(shop-b 预付配档,仅测试支付)
 *   → 分箱 → 按箱设配送 → 选「货到付款」调用 OrderSplitService.performSplitCheckout
 *   → 断言拆成 2 单且各自下单采用不同配送方式/支付。
 *
 * 运行：DB=postgres node -r ts-node/register -r dotenv/config -r tsconfig-paths/register verify-split.ts
 */
import { bootstrap, ChannelService, CustomerService, isGraphQlErrorResult, JobQueueService, OrderService, ProductVariantService, RequestContext, RequestContextService, TransactionalConnection } from '@vendure/core';

import { devConfig } from './dev-config';
import { createAdminCtx } from './china-data/shared';

// 编译产物 require，保证与插件 provider 使用的类对象 token 一致（app.get 才能命中）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OrderBoxService } = require('@vendure/cjk-plugin/lib/src/order/order-box.service.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OrderSplitService } = require('@vendure/cjk-plugin/lib/src/order/order-split.service.js');

let pass = 0;
let fail = 0;
const failed: string[] = [];
function expect(cond: boolean, msg: string): void {
    if (cond) { pass++; console.log(`  ✓ ${msg}`); }
    else { fail++; failed.push(msg); console.error(`  ✗ ${msg}`); }
}

async function main() {
    const app = await bootstrap(devConfig);
    await app.get(JobQueueService).start();

    const channelService = app.get(ChannelService);
    const customerService = app.get(CustomerService);
    const orderService = app.get(OrderService);
    const variantService = app.get(ProductVariantService);
    const ctxService = app.get(RequestContextService);
    const orderBoxService: any = app.get(OrderBoxService);
    const orderSplitService: any = app.get(OrderSplitService);
    const transactionConn = app.get(TransactionalConnection);

    // 取订单已落地运费行对应的配送方式名（shippingLines.shippingMethod 关系不返回对象，改按 id 查实体解析名字）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ShippingMethod } = require('@vendure/core/dist/entity/shipping-method/shipping-method.entity.js');
    const ship = async (o: any): Promise<string> => {
        const rel = await orderService.findOne(adminCtx, o.id, ['shippingLines']);
        const repo = transactionConn.getRepository(ShippingMethod);
        const names: string[] = [];
        for (const s of rel?.shippingLines ?? []) {
            const m = s.shippingMethod ?? await repo.findOne({ where: { id: s.shippingMethodId }, relations: ['translations'] });
            const nm = m?.translations?.find((t: any) => t?.name)?.name ?? m?.name;
            names.push(nm ?? `#${s.shippingMethodId}`);
        }
        return names.filter(Boolean).join(',') || '(无运费行)';
    };

    const defaultChannel = await channelService.getDefaultChannel();
    const adminCtx = await createAdminCtx(app, defaultChannel);

    // 1. 客户 zhangsan
    const customers = await customerService.findAll(adminCtx, { filter: { emailAddress: { eq: 'zhangsan@test.cn' } }, take: 1 });
    const customer = customers.items[0];
    const full = await customerService.findOne(adminCtx, customer.id, ['user', 'addresses']);
    if (!full?.user?.id) { console.error('zhangsan 无 user'); process.exit(1); }
    console.log(`\n[1] 客户: zhangsan@test.cn (id=${customer.id}, userId=${full.user.id})`);

    // 2. 建单 + 加两个 SKU
    console.log('\n[2] 建单并加入 NF-RICE-5KG + HW-ROUTER-STD');
    const order: any = await orderService.create(adminCtx, full.user.id);
    const rice = (await variantService.findAll(adminCtx, { filter: { sku: { eq: 'NF-RICE-5KG' } }, take: 1 })).items[0];
    const router = (await variantService.findAll(adminCtx, { filter: { sku: { eq: 'HW-ROUTER-STD' } }, take: 1 })).items[0];
    expect(!!rice && !!router, `两个变体存在: ${rice?.sku} / ${router?.sku}`);
    const r1 = await orderService.addItemToOrder(adminCtx, order.id, rice.id, 2);
    const r2 = await orderService.addItemToOrder(adminCtx, order.id, router.id, 1);
    expect(!isGraphQlErrorResult(r1) && !isGraphQlErrorResult(r2), '两个 SKU 加入成功');

    // 3. 配送地址
    await orderService.setShippingAddress(adminCtx, order.id, {
        fullName: '张三', streetLine1: '北京市海淀区中关村大街1号',
        city: '北京市', province: '北京市', postalCode: '100080', countryCode: 'CN',
    });

    // 4. 分箱 + 打印每箱支付白名单（展示拆单成因）
    console.log('\n[3] 分箱结果');
    const loaded: any = await orderService.findOne(adminCtx, order.id, ['lines.productVariant']);
    const boxes: any[] = await orderBoxService.computeOrderBoxes(adminCtx, loaded);
    for (const b of boxes) {
        console.log(`    box=${b.boxKey} profile=${b.profileName} lineIds=${JSON.stringify(b.lineIds)}`);
        console.log(`      可用配送=${b.availableShippingMethodIds} 默认=${b.defaultShippingMethodId}`);
        console.log(`      可用支付=${JSON.stringify(b.availablePaymentMethodCodes)}`);
    }
    expect(boxes.length === 2, `期望 2 箱, 实际 ${boxes.length}`);

    // 5. 每箱设配送方式（用默认），保存到 order
    console.log('\n[4] 按箱设置配送方式');
    for (const b of boxes) {
        await orderBoxService.setBoxShippingMethod(adminCtx, loaded, b.boxKey, b.defaultShippingMethodId);
        expect(true, `箱 ${b.boxKey} 设配送 ${b.defaultShippingMethodId}`);
    }

    // 6. 客户 ctx + 拆单结算（选货到付款）
    console.log('\n[5] checkoutSplitted(method=cash-on-delivery)');
    const customerCtx = await ctxService.create({ apiType: 'shop', channelOrToken: defaultChannel, user: full.user as any });
    const refreshed: any = await orderService.findOne(adminCtx, order.id, ['lines.productVariant']);
    const settled: any[] = await transactionConn.withTransaction(customerCtx, async txc =>
        orderSplitService.performSplitCheckout(txc, refreshed, 'cash-on-delivery'),
    );
    expect(Array.isArray(settled) && settled.length === 2, `拆单返回 ${settled.length} 个订单（期望 2）`);

    // 重载结算后的订单，读取运费/支付信息
    // 运费由 LogisticsPlugin 在结算后异步重算落地，故轮询等待其出现（最多 3s）
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const finalOrders: any[] = [];
    for (const o of settled) {
        let fo: any = await orderService.findOne(adminCtx, o.id, ['lines.productVariant', 'payments']);
        for (let t = 0; t < 15 && (fo.shippingWithTax ?? 0) === 0; t++) {
            await sleep(200);
            fo = await orderService.findOne(adminCtx, o.id, ['lines.productVariant', 'payments']);
        }
        finalOrders.push(fo);
    }

    for (const o of finalOrders) {
        const lines = (o.lines ?? []).map((l: any) => `${l.productVariant?.sku ?? l.productVariantId} x${l.quantity}`).join(', ');
        const pay = (o.payments ?? []).map((p: any) => p.method).join(',');
        console.log(`    code=${o.code} state=${o.state} total=${o.total} shipFee=${o.shippingWithTax ?? o.shipping} lines=[${lines}] 支付=${pay}`);
    }
    if (finalOrders.length === 2) {
        const s1 = finalOrders[0], s2 = finalOrders[1];
        const hasRice = (o: any) => (o.lines ?? []).some((l: any) => l.productVariant?.sku === 'NF-RICE-5KG');
        const hasRouter = (o: any) => (o.lines ?? []).some((l: any) => l.productVariant?.sku === 'HW-ROUTER-STD');
        const riceOrder = s1 && hasRice(s1) ? s1 : (s2 && hasRice(s2) ? s2 : null);
        const routerOrder = s1 && hasRouter(s1) ? s1 : (s2 && hasRouter(s2) ? s2 : null);
        expect(!!riceOrder && !!routerOrder && riceOrder.id !== routerOrder.id, '两单各自独立且商品分离');
        const riceShipping = riceOrder ? await ship(riceOrder) : '';
        const routerShipping = routerOrder ? await ship(routerOrder) : '';
        expect(!!riceOrder && (riceShipping.includes('顺丰') || riceShipping.includes('中通')), `大米单走 shop-a 配送[${riceShipping}]`);
        expect(!!routerOrder && routerShipping.includes('京东'), `路由器单走 shop-b 配送[${routerShipping}]`);
        const bothSettled = finalOrders.every((o: any) => o.state === 'PaymentSettled' || o.state === 'PaymentAuthorized');
        expect(bothSettled, '两单均已结算/授权');
    }

    await app.close();
    console.log(`\n=== 汇总 === 通过: ${pass}, 失败: ${fail}`);
    if (fail > 0) { failed.forEach(m => console.error(`  - ${m}`)); process.exit(1); }
    console.log('拆单实测通过');
    process.exit(0);
}

main().catch(err => { console.error('\n=== 异常 ==='); console.error(err); process.exit(1); });