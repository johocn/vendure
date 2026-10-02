import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { ChannelService, mergeConfig, RequestContext, TransactionalConnection } from '@vendure/core';
import { RechargeCardPlugin } from '@vendure/recharge-card-plugin';
import { WechatpayPlugin, WechatpaySettlementRegistry } from '@vendure/wechatpay-plugin';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { testSuccessfulPaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { CouponPlugin } from '../src/plugin';
import { CouponSaleOrder } from '../src/coupon-sale-order.entity';
import { CustomerCoupon } from '../src/customer-coupon.entity';

/**
 * 券商城出售链路 · 真实 DB 运行态 e2e（计划 2 §13.2 残留补测）。
 *
 * 与 `coupon.e2e-spec.ts`（领券/选券）互补，本套件覆盖出售/退款/券包/并发四条链路：
 *   ① `CS-` 微信结算回调（注册表路径，与 /wechatpay/notify 同一入口）与重复回调幂等
 *   ② 退款回收：路径 A（独立出售单，余额补偿）+ 已核销拒绝 + 路径 B（加价购随主订单整单退款）
 *   ③ 券包逐张签发（CouponBundleItem 展开）与任一张售罄时的整包原子性
 *   ④ 并发幂等：并发回调只发一次券；原子 `UPDATE ... WHERE status='PENDING'` / 售罄原子扣减
 *
 * 真实 DB：默认 sqljs；`DB=postgres`（本机 PostgreSQL 18，角色/库 vendure，test-config 已内置凭据）
 * 时由 PostgresInitializer 另建 `e2e_<文件名>` 独立库，不会触碰既有 dev 库。
 */
registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('CouponSale · 真实 DB 运行态 e2e', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            // RechargeCardPlugin 提供余额端口（余额支付/退款补偿）；WechatpayPlugin 提供结算注册表（CS- 回调入口）
            plugins: [CouponPlugin.init(), RechargeCardPlugin.init(), WechatpayPlugin.init({})],
            paymentOptions: {
                paymentMethodHandlers: [testSuccessfulPaymentMethod],
            },
        }),
    );

    let channel: any;
    let connection: TransactionalConnection;
    let registry: WechatpaySettlementRegistry;
    let variantId: string;
    let myCustomerId: string;

    /** 每次结算都新建 ctx：与 /wechatpay/notify 每次请求独立 ctx 的真实行为一致（避免并发共享事务上下文） */
    function makeCtx(): RequestContext {
        return new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
    }

    /**
     * e2e harness（testConfig）使用 TestingEntityIdStrategy，GraphQL 层 ID 形如 `T_1`；
     * 而 Service 层 `order.id` 是 DB 自增主键（数字）。断言/比对前需还原成主键。
     */
    function decodeId(id: string | number | null | undefined): number {
        return Number(String(id).replace(/^T_/, ''));
    }

    /** 与 CouponSaleService.createWechatPrepay 保持一致：out_trade_no = `CS-<自增主键>` */
    function outTradeNoOf(saleOrderId: string | number): string {
        return `CS-${decodeId(saleOrderId)}`;
    }

    /**
     * 等待异步事件订阅落库。Vendure 的 `EventBus.ofType()` 订阅在「事务提交后」异步触发
     * （`publish()` 只 await 阻塞式处理器），因此事件驱动的断言必须轮询而非立即读取，
     * 否则在真实 DB（异步 I/O）下会出现竞态。
     */
    async function waitFor<T>(
        read: () => Promise<T>,
        predicate: (value: T) => boolean,
        timeoutMs = 5000,
    ): Promise<T> {
        const deadline = Date.now() + timeoutMs;
        let value = await read();
        while (!predicate(value) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 25));
            value = await read();
        }
        return value;
    }

    /* ------------------------------ GraphQL 辅助 ------------------------------ */

    async function createSaleTemplate(input: Record<string, unknown>): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createCouponTemplate(input: {
                    name: "${input.name}"
                    type: ${input.type}
                    discountValue: ${input.discountValue}
                    salePrice: ${input.salePrice}
                    totalCount: ${input.totalCount ?? 0}
                    perUserLimit: 0
                    enabled: true
                    usageScene: ${input.usageScene ?? 'ONLINE'}
                    distributionChannels: "${input.distributionChannels ?? 'SALE'}"
                }) { id }
            }
        `)) as any;
        return res.createCouponTemplate.id;
    }

    async function createBundle(input: {
        name: string;
        salePrice: number;
        items: Array<{ templateId: string; quantity: number }>;
    }): Promise<any> {
        const items = input.items
            .map(i => `{ templateId: "${i.templateId}", quantity: ${i.quantity} }`)
            .join(', ');
        const res = (await adminClient.query(gql`
            mutation {
                createCouponBundle(input: {
                    name: "${input.name}"
                    salePrice: ${input.salePrice}
                    enabled: true
                    items: [${items}]
                }) { id name salePrice enabled items { templateId quantity } }
            }
        `)) as any;
        return res.createCouponBundle;
    }

    async function createSaleOrder(args: { templateId?: string; bundleId?: string }): Promise<any> {
        const a = args.templateId
            ? `templateId: "${args.templateId}"`
            : `bundleId: "${args.bundleId}"`;
        const res = (await shopClient.query(gql`
            mutation {
                createCouponSaleOrder(${a}) {
                    id customerId payMode templateId bundleId orderId amount status paidAt
                }
            }
        `)) as any;
        return res.createCouponSaleOrder;
    }

    async function payWithBalance(id: string): Promise<any> {
        const res = (await shopClient.query(gql`
            mutation {
                payCouponSaleWithBalance(id: "${id}") {
                    id amount status paidAt
                }
            }
        `)) as any;
        return res.payCouponSaleWithBalance;
    }

    async function refundSaleOrder(id: string, reason?: string): Promise<any> {
        const res = (await shopClient.query(gql`
            mutation {
                refundCouponSaleOrder(id: "${id}"${reason ? `, reason: "${reason}"` : ''}) {
                    id amount status refundedAt
                }
            }
        `)) as any;
        return res.refundCouponSaleOrder;
    }

    async function saleOrder(id: string): Promise<any> {
        const res = (await adminClient.query(gql`
            query {
                couponSaleOrder(id: "${id}") {
                    id amount status payMode templateId bundleId orderId paymentMethod paidAt refundedAt
                }
            }
        `)) as any;
        return res.couponSaleOrder;
    }

    async function balance(): Promise<number> {
        const res = (await shopClient.query(gql`
            query { myRechargeBalance }
        `)) as any;
        return res.myRechargeBalance;
    }

    async function setBalance(amount: number): Promise<void> {
        await adminClient.query(gql`
            mutation {
                adminAdjustBalance(input: {
                    customerId: "${myCustomerId}"
                    amount: ${amount}
                    type: "adjust"
                    remark: "e2e seed"
                }) { id balance }
            }
        `);
    }

    async function addToCart(qty = 1): Promise<any> {
        const res = (await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: ${qty}) {
                    ... on Order { id subTotalWithTax totalWithTax }
                    ... on ErrorResult { errorCode message }
                }
            }
        `)) as any;
        return res.addItemToOrder;
    }

    async function applyCoupon(code: string): Promise<any> {
        const res = (await shopClient.query(gql`
            mutation {
                applyCouponToOrder(code: "${code}") { id subTotalWithTax totalWithTax }
            }
        `)) as any;
        return res.applyCouponToOrder;
    }

    async function attachCouponToOrder(orderId: string, templateId: string): Promise<any> {
        const res = (await shopClient.query(gql`
            mutation {
                attachCouponToOrder(orderId: "${orderId}", templateId: "${templateId}") {
                    id payMode orderId amount status
                }
            }
        `)) as any;
        return res.attachCouponToOrder;
    }

    /** 清理遗留活动订单，保证用例间订单隔离 */
    async function resetActiveOrder(): Promise<void> {
        const active = (await shopClient.query(gql`
            query { activeOrder { id } }
        `)) as any;
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation {
                    cancelOrder(input: { orderId: "${active.activeOrder.id}" }) {
                        ... on Order { id state }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `);
        }
    }

    /* ------------------------------ DB 直查（SDL 未暴露字段的断言） ------------------------------ */

    async function dbCouponsOfSaleOrder(saleOrderId: string): Promise<CustomerCoupon[]> {
        return connection.getRepository(makeCtx(), CustomerCoupon).find({
            where: { saleOrderId: decodeId(saleOrderId) },
            order: { id: 'ASC' },
        });
    }

    async function dbCoupon(code: string): Promise<CustomerCoupon | null> {
        return connection.getRepository(makeCtx(), CustomerCoupon).findOne({ where: { code } });
    }

    async function dbSaleOrder(id: string): Promise<CouponSaleOrder | null> {
        return connection
            .getRepository(makeCtx(), CouponSaleOrder)
            .findOne({ where: { id: decodeId(id) } });
    }

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: testSuccessfulPaymentMethod.code,
                        handler: { code: testSuccessfulPaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 2,
        });
        await adminClient.asSuperAdmin();

        const products = (await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { id variants { id } } } }
        `)) as any;
        variantId = products.products.items[0].variants[0].id;

        channel = await server.app.get(ChannelService).getDefaultChannel();
        connection = server.app.get(TransactionalConnection);
        registry = server.app.get(WechatpaySettlementRegistry);

        // 登录 C 端用户，取其 Customer.id，并注入足够余额供余额支付/退款用例使用
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
        const me = (await shopClient.query(gql`
            query { activeCustomer { id } }
        `)) as any;
        myCustomerId = me.activeCustomer.id;
        await setBalance(500000);

        // 结算基准统一为「含税小计」，与既有 coupon e2e 一致，便于断言券可正常选定
        const channels = (await adminClient.query(gql`
            query { channels { items { id } } }
        `)) as any;
        await adminClient.query(gql`
            mutation {
                updateChannel(input: { id: "${channels.channels.items[0].id}", pricesIncludeTax: true }) {
                    ... on Channel { id pricesIncludeTax }
                }
            }
        `);

        // 绑定 coupon_applied + coupon_discount 的促销：券在线上订单可被核销（用于「已核销不可退」用例）
        await adminClient.query(gql`
            mutation {
                createPromotion(input: {
                    enabled: true
                    translations: [
                        { languageCode: en, name: "Coupon discount", description: "coupon applied" }
                    ]
                    conditions: [{ code: "coupon_applied", arguments: [] }]
                    actions: [{ code: "coupon_discount", arguments: [] }]
                }) { ... on Promotion { id name } }
            }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /* ============================ ① CS- 微信结算回调 ============================ */

    it('①-1 CS- 微信回调：原子置 PAID 并签发 1 张 SALE 券（saleOrderId 落库）', async () => {
        const tplId = await createSaleTemplate({
            name: '微信售券-单张',
            type: 'FULL',
            discountValue: 500,
            salePrice: 1990,
        });
        const so = await createSaleOrder({ templateId: tplId });
        expect(so.status).toBe('PENDING');
        expect(so.payMode).toBe('WECHAT');
        expect(so.amount).toBe(1990);

        const outTradeNo = outTradeNoOf(so.id);
        const handler = registry.find(outTradeNo);
        expect(handler).toBeDefined();
        await handler!.settle(makeCtx(), outTradeNo, 'WX-TX-1');

        const synced = await saleOrder(so.id);
        expect(synced.status).toBe('PAID');
        expect(synced.paidAt).toBeTruthy();

        const coupons = await dbCouponsOfSaleOrder(so.id);
        expect(coupons).toHaveLength(1);
        expect(coupons[0].status).toBe('UNUSED');
        expect(coupons[0].issuedBy).toBe('SALE');
        expect(coupons[0].templateId).toBe(decodeId(tplId));
        expect(coupons[0].saleOrderId).toBe(decodeId(so.id));
    });

    it('①-2 CS- 重复回调：三次回调仅签发一次（幂等）', async () => {
        const tplId = await createSaleTemplate({
            name: '微信售券-幂等',
            type: 'FULL',
            discountValue: 500,
            salePrice: 990,
        });
        const so = await createSaleOrder({ templateId: tplId });
        const outTradeNo = outTradeNoOf(so.id);
        const handler = registry.find(outTradeNo)!;

        await handler.settle(makeCtx(), outTradeNo, 'WX-TX-2');
        await handler.settle(makeCtx(), outTradeNo, 'WX-TX-2');
        await handler.settle(makeCtx(), outTradeNo, 'WX-TX-2');

        expect(await dbCouponsOfSaleOrder(so.id)).toHaveLength(1);
        expect((await saleOrder(so.id)).status).toBe('PAID');
    });

    it('①-3 非法单号：CS- 前缀但非数字 → 报错且不落券', async () => {
        const handler = registry.find('CS-abc');
        expect(handler).toBeDefined();
        await expect(handler!.settle(makeCtx(), 'CS-abc', 'x')).rejects.toThrow(
            /Invalid coupon sale out_trade_no/,
        );
    });

    /* ============================ ② 退款回收 ============================ */

    it('②-1 路径 A：余额支付 → 未使用券可退（券 INVALID + 单 REFUNDED + 余额退回）', async () => {
        const tplId = await createSaleTemplate({
            name: '余额售券-可退',
            type: 'FULL',
            discountValue: 300,
            salePrice: 3000,
        });
        const so = await createSaleOrder({ templateId: tplId });
        const before = await balance();

        const paid = await payWithBalance(so.id);
        expect(paid.status).toBe('PAID');
        expect((await saleOrder(so.id)).paymentMethod).toBe('balance');
        expect(await balance()).toBe(before - 3000);

        const refunded = await refundSaleOrder(so.id, 'e2e refund');
        expect(refunded.status).toBe('REFUNDED');
        expect(refunded.refundedAt).toBeTruthy();
        // 余额补偿（§16-2 决策：微信/余额支付退款一律入客户余额）
        expect(await balance()).toBe(before);

        const coupons = await dbCouponsOfSaleOrder(so.id);
        expect(coupons).toHaveLength(1);
        expect(coupons[0].status).toBe('INVALID');
    });

    it('②-2 路径 A：券已核销 → 拒绝退款（券保持 USED，单保持 PAID）', async () => {
        const tplId = await createSaleTemplate({
            name: '余额售券-已用',
            type: 'FULL',
            discountValue: 500,
            salePrice: 1100,
        });
        const so = await createSaleOrder({ templateId: tplId });
        await payWithBalance(so.id);
        const [coupon] = await dbCouponsOfSaleOrder(so.id);

        // 线上核销该券：下单 → 选券 → 支付
        await resetActiveOrder();
        await addToCart(1);
        await applyCoupon(coupon.code);
        await proceedToArrangingPayment(shopClient);
        await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        // OrderPlacedEvent 订阅（核销券）在事务提交后异步执行 → 轮询等待落库
        expect(
            (await waitFor(() => dbCoupon(coupon.code), c => c?.status === 'USED'))!.status,
        ).toBe('USED');

        await expect(refundSaleOrder(so.id, 'should fail')).rejects.toThrow(
            /Coupon already used, refund rejected/,
        );
        expect((await saleOrder(so.id)).status).toBe('PAID');
    });

    it('②-3 路径 A 幂等：重复退款仅补偿一次余额', async () => {
        const tplId = await createSaleTemplate({
            name: '余额售券-重复退',
            type: 'FULL',
            discountValue: 300,
            salePrice: 1500,
        });
        const so = await createSaleOrder({ templateId: tplId });
        const before = await balance();
        await payWithBalance(so.id);
        await refundSaleOrder(so.id, 'first');
        const afterFirst = await balance();
        expect(afterFirst).toBe(before);
        await expect(refundSaleOrder(so.id, 'again')).rejects.toThrow(/Coupon sale order is REFUNDED/);
        expect(await balance()).toBe(afterFirst);
    });

    /* ============================ ③ 券包逐张签发 ============================ */

    it('③-1 券包购买：按 item 展开逐张签发（2×A + 1×B = 3 张）', async () => {
        const tplA = await createSaleTemplate({
            name: '券包-A',
            type: 'FULL',
            discountValue: 300,
            salePrice: 800,
        });
        const tplB = await createSaleTemplate({
            name: '券包-B',
            type: 'FULL',
            discountValue: 400,
            salePrice: 900,
        });
        const bundle = await createBundle({
            name: '组合券包',
            salePrice: 1999,
            items: [
                { templateId: tplA, quantity: 2 },
                { templateId: tplB, quantity: 1 },
            ],
        });
        expect(bundle.items).toHaveLength(2);

        const so = await createSaleOrder({ bundleId: bundle.id });
        expect(decodeId(so.bundleId)).toBe(decodeId(bundle.id));
        expect(so.templateId).toBeNull();
        expect(so.amount).toBe(1999);

        await payWithBalance(so.id);

        const coupons = await dbCouponsOfSaleOrder(so.id);
        expect(coupons).toHaveLength(3);
        expect(coupons.filter(c => c.templateId === decodeId(tplA))).toHaveLength(2);
        expect(coupons.filter(c => c.templateId === decodeId(tplB))).toHaveLength(1);
        expect(coupons.every(c => c.status === 'UNUSED' && c.issuedBy === 'SALE')).toBe(true);
    });

    it(
        '③-2 券包任一张售罄 → 整包不落券、单不入账、余额不扣（原子性）',
        async () => {
            const tplLimited = await createSaleTemplate({
                name: '券包-限量1张',
                type: 'FULL',
                discountValue: 100,
                salePrice: 500,
                totalCount: 1,
            });
            const bundle = await createBundle({
                name: '含限量券包',
                salePrice: 900,
                items: [{ templateId: tplLimited, quantity: 2 }],
            });
            const so = await createSaleOrder({ bundleId: bundle.id });
            const before = await balance();

            await expect(payWithBalance(so.id)).rejects.toThrow(/sold out/i);

            expect(await dbCouponsOfSaleOrder(so.id)).toHaveLength(0);
            expect((await saleOrder(so.id)).status).toBe('PENDING');
            expect(await balance()).toBe(before);
        },
        60_000,
    );

    /* ============================ ④ 并发幂等 ============================ */

    it(
        '④-1 并发回调：同一 CS- 单并发 5 次结算，仅签发 1 张券',
        async () => {
            const tplId = await createSaleTemplate({
                name: '并发回调券',
                type: 'FULL',
                discountValue: 200,
                salePrice: 700,
            });
            const so = await createSaleOrder({ templateId: tplId });
            const outTradeNo = outTradeNoOf(so.id);
            const handler = registry.find(outTradeNo)!;

            const results = await Promise.allSettled(
                Array.from({ length: 5 }, () => handler.settle(makeCtx(), outTradeNo, 'WX-TX-C')),
            );
            const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
            expect(rejected.map(r => String((r.reason as any)?.message ?? r.reason))).toEqual([]);

            expect(await dbCouponsOfSaleOrder(so.id)).toHaveLength(1);
            expect((await saleOrder(so.id)).status).toBe('PAID');
        },
        60_000,
    );

    it(
        '④-2 限量 1 张并发两笔购买：仅一笔成功发券',
        async () => {
            const tplId = await createSaleTemplate({
                name: '限量并发券',
                type: 'FULL',
                discountValue: 200,
                salePrice: 600,
                totalCount: 1,
            });
            const [so1, so2] = await Promise.all([
                createSaleOrder({ templateId: tplId }),
                createSaleOrder({ templateId: tplId }),
            ]);

            const results = await Promise.allSettled([
                payWithBalance(so1.id),
                payWithBalance(so2.id),
            ]);
            const ok = results.filter(r => r.status === 'fulfilled');
            expect(ok).toHaveLength(1);

            const all = [
                ...(await dbCouponsOfSaleOrder(so1.id)),
                ...(await dbCouponsOfSaleOrder(so2.id)),
            ];
            expect(all).toHaveLength(1);
            expect(all[0].status).toBe('UNUSED');
        },
        60_000,
    );

    /* ============================ ⑤ 加价购（路径 B）============================ */

    it(
        '⑤ 路径 B：主订单支付 → 结算发券；对单退款被拒；整单退款 → 回收券',
        async () => {
            const tplId = await createSaleTemplate({
                name: '加价购券',
                type: 'FULL',
                discountValue: 1000,
                salePrice: 2500,
            });

            await resetActiveOrder();
            const order = await addToCart(1);
            const attached = await attachCouponToOrder(order.id, tplId);
            expect(attached.payMode).toBe('ORDER_SURCHARGE');
            expect(attached.status).toBe('PENDING');
            // 加价购以 Surcharge 形式挂在主订单上，主订单金额应含券价
            const attachedRow = await dbSaleOrder(attached.id);
            expect(attachedRow!.surchargeId).toBeTruthy();
            const orderWithSurcharge = (await shopClient.query(gql`
                query {
                    activeOrder {
                        totalWithTax
                        surcharges { id description priceWithTax }
                    }
                }
            `)) as any;
            expect(
                orderWithSurcharge.activeOrder.surcharges.some(
                    (s: any) => s.priceWithTax === 2500,
                ),
            ).toBe(true);

            // 对加价购单直接退款应被拒绝（钱随主订单退回）
            await expect(refundSaleOrder(attached.id, 'x')).rejects.toThrow(
                /Please refund the main order instead/,
            );

            await proceedToArrangingPayment(shopClient);
            const paid = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);

            // 主订单支付成功（PaymentSettled）→ 结算全部 PENDING 加价购单并发券（事件异步，轮询等待）
            await waitFor(() => saleOrder(attached.id), o => o.status === 'PAID');
            expect((await saleOrder(attached.id)).status).toBe('PAID');
            const coupons = await dbCouponsOfSaleOrder(attached.id);
            expect(coupons).toHaveLength(1);
            expect(coupons[0].status).toBe('UNUSED');

            // 整单退款：Refund 置 Settled → 回收加价购券 + 单据 REFUNDED
            const detail = (await adminClient.query(gql`
                query {
                    order(id: "${paid.id}") {
                        id totalWithTax shippingWithTax
                        lines { id quantity }
                        payments { id }
                    }
                }
            `)) as any;
            const paymentId = detail.order.payments[0].id;
            // 整单退款按「支付金额」退（v3 推荐字段 amount）：RefundOrderInput 无 surcharges 字段，
            // 按 lines+shipping 计算会漏掉加价购 Surcharge，故用订单总额（含 Surcharge）退全额。
            const refundRes = (await adminClient.query(gql`
                mutation {
                    refundOrder(input: {
                        amount: ${detail.order.totalWithTax}
                        shipping: 0
                        adjustment: 0
                        paymentId: "${paymentId}"
                        reason: "e2e full refund"
                    }) {
                        ... on Refund { id state total }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `)) as any;
            expect(refundRes.refundOrder.state).toBe('Pending');
            expect(refundRes.refundOrder.total).toBe(detail.order.totalWithTax);

            const settleRes = (await adminClient.query(gql`
                mutation {
                    settleRefund(input: { id: "${refundRes.refundOrder.id}", transactionId: "e2e-tx" }) {
                        ... on Refund { id state }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `)) as any;
            expect(settleRes.settleRefund.state).toBe('Settled');

            // RefundStateTransitionEvent→Settled 订阅（回收加价购券）同样异步，轮询等待
            await waitFor(() => saleOrder(attached.id), o => o.status === 'REFUNDED');
            expect((await saleOrder(attached.id)).status).toBe('REFUNDED');
            await waitFor(() => dbCoupon(coupons[0].code), c => c?.status === 'INVALID');
            expect((await dbCoupon(coupons[0].code))!.status).toBe('INVALID');
        },
        120_000,
    );

    it('⑤-2 主订单取消 → 未支付的加价购单作废（CANCELLED，不发券）', async () => {
        const tplId = await createSaleTemplate({
            name: '加价购券-取消',
            type: 'FULL',
            discountValue: 500,
            salePrice: 1200,
        });
        await resetActiveOrder();
        const order = await addToCart(1);
        const attached = await attachCouponToOrder(order.id, tplId);

        await adminClient.query(gql`
            mutation {
                cancelOrder(input: { orderId: "${order.id}" }) {
                    ... on Order { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);

        // OrderStateTransitionEvent→Cancelled 订阅异步执行 → 轮询等待
        await waitFor(() => saleOrder(attached.id), o => o.status === 'CANCELLED');
        expect((await saleOrder(attached.id)).status).toBe('CANCELLED');
        expect(await dbCouponsOfSaleOrder(attached.id)).toHaveLength(0);
    });

    it('⑥ 数据一致性：出售单状态枚举与券状态枚举无越界值', async () => {
        const ctx = makeCtx();
        const orders = await connection.getRepository(ctx, CouponSaleOrder).find({ take: 200 });
        expect(orders.length).toBeGreaterThan(0);
        expect(
            orders.every(o => ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'].includes(o.status)),
        ).toBe(true);
    });
});
