import { mergeConfig, RequestContextService, TransactionalConnection } from '@vendure/core';
import {
    createTestEnvironment,
    registerInitializer,
    SimpleGraphQLClient,
    SqljsInitializer,
} from '@vendure/testing';
import { ShopPlugin } from '@vendure/shop-plugin';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';

import { AffiliatePlugin } from '../src/affiliate.plugin';
import { Affiliate } from '../src/affiliate.entity';
import { AffiliateCommissionEntry } from '../src/affiliate-commission.entity';
import { AffiliateWithdrawal } from '../src/affiliate-withdrawal.entity';
import { AffiliateService } from '../src/affiliate.service';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 事件订阅 → 异步入账，需轮询等待。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 6000, intervalMs = 100): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

/** 测试 EntityIdStrategy 会给 ID 加 `T_` 前缀；原始仓库查询需还原纯数字 id。 */
function numericId(encoded: string | number): number {
    return Number(String(encoded).replace(/^T_/, ''));
}

describe('AffiliatePlugin · 阶段29 分销返利全链路', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), AffiliatePlugin.init({ defaultRate: 30 })],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;
    const shopApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`;

    const ownerEmail = 'ownerA.aff@test.com';
    const promoEmail = 'promo@test.com';
    const mainEmail = 'main.aff@test.com';
    const buyerEmail = 'buyer@test.com';
    const buyer2Email = 'buyer2@test.com';

    let shopAId: string;
    let variantDefaultId: string;
    let variantRatedId: string;
    let codePromo: string;
    let codeMain: string;

    // 由用例1 生成的两个推广员 client（相互关系 A=promo/B=main）
    let promoClient: SimpleGraphQLClient;
    let mainAffClient: SimpleGraphQLClient;
    let buyer2Client: SimpleGraphQLClient;
    let ownerClient: SimpleGraphQLClient;

    let c3 = 0; // 默认商品订单佣金
    let c4 = 0; // 商品级费率(10%)订单佣金
    let c5 = 0; // 退款单佣金
    let ratedOrderId: string;
    let wd1Id: string;

    const MY_AFFILIATE = gql`
        query {
            myAffiliate { id shopId code status totalCommission withdrawableCommission }
        }
    `;
    const MY_ENTRIES = gql`
        query {
            myCommissionEntries {
                id affiliateId customerId orderId orderLineId shopId baseAmount rate commissionAmount loadOn status
            }
        }
    `;

    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation { createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) { id name status } }
        `)) as any;
        await adminClient.query(gql`
            mutation { setShopStatus(id: "${res.createShop.id}", status: "active") { id status } }
        `);
        return res.createShop.id as string;
    }

    async function provisionOwner(shopId: string, email: string): Promise<void> {
        await adminClient.query(gql`
            mutation {
                provisionShopOwner(shopId: "${shopId}", input: {
                    emailAddress: "${email}", password: "test", firstName: "店", lastName: "A"
                }) { id }
            }
        `);
    }

    async function createProduct(
        name: string,
        slug: string,
        taxCategoryId: string,
        customFieldsGql?: string,
    ): Promise<{ productId: string; variantId: string }> {
        const cf = customFieldsGql ? `customFields: ${customFieldsGql}` : '';
        const p = (await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                    ${cf}
                }) { ... on Product { id } }
            }
        `)) as any;
        const productId = p.createProduct.id as string;
        const v = (await adminClient.query(gql`
            mutation {
                createProductVariants(input: [{
                    productId: "${productId}"
                    sku: "${slug}-v"
                    price: 100
                    taxCategoryId: "${taxCategoryId}"
                    trackInventory: FALSE
                    translations: [{ languageCode: en, name: "${name} variant" }]
                }]) { ... on ProductVariant { id } }
            }
        `)) as any;
        return { productId, variantId: v.createProductVariants[0].id as string };
    }

    async function assign(shopId: string, productIds: string[]): Promise<void> {
        await adminClient.query(gql`
            mutation { assignProductsToShop(input: { shopId: "${shopId}", productIds: [${productIds.map(id => `"${id}"`).join(',')}] }) }
        `);
    }

    async function resetActiveOrder(cli: SimpleGraphQLClient = shopClient): Promise<void> {
        try {
            await cli.query(gql`mutation { removeAllOrderLines { ... on Order { id } } }`);
        } catch {
            // no active order → ignore
        }
    }

    /** 好友下单并付款，返回 orderId。默认用 shopClient(买家 buyer)；可在最后一个参数指定其它顾客。 */
    async function createPaidOrder(
        variantId: string,
        qty = 1,
        cli: SimpleGraphQLClient = shopClient,
    ): Promise<string> {
        await resetActiveOrder(cli);
        await cli.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: ${qty}) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(cli);
        const paid = await addPaymentToOrder(cli, singleStageRefundablePaymentMethod);
        expect(paid.id).toBeDefined();
        return String(paid.id);
    }

    /** 推进订单：fulfillment → Shipped，（target=Delivered 时）→ Delivered。返回 fId。 */
    async function transitionOrderTo(orderId: string, target: 'Shipped' | 'Delivered', fId?: string): Promise<string> {
        if (!fId) {
            const detail = (await adminClient.query(gql`
                query { order(id: "${orderId}") { id lines { id quantity } } }
            `)) as any;
            const lines = detail.order.lines.map((l: any) => `{ orderLineId: "${l.id}", quantity: ${l.quantity} }`).join(' ');
            const f = (await adminClient.query(gql`
                mutation {
                    addFulfillmentToOrder(input: {
                        lines: [${lines}]
                        handler: { code: "manual-fulfillment" arguments: [
                            { name: "method", value: "standard" }
                            { name: "trackingCode", value: "SF123456" }
                        ] }
                    }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } }
                }
            `)) as any;
            fId = f.addFulfillmentToOrder.id;
            expect(fId).toBeDefined();
        }
        await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Shipped") { ... on Fulfillment { id state } } }`);
        await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Shipped") { ... on Order { id state } } }`);
        if (target === 'Delivered') {
            await adminClient.query(gql`mutation { transitionFulfillmentToState(id: "${fId}", state: "Delivered") { ... on Fulfillment { id state } } }`);
            await adminClient.query(gql`mutation { transitionOrderToState(id: "${orderId}", state: "Delivered") { ... on Order { id state } } }`);
        }
        const after = (await adminClient.query(gql`query { order(id: "${orderId}") { state } }`)) as any;
        expect(after.order.state).toBe(target);
        return fId;
    }

    /** 对已支付订单整单退款，推进至 Refund Settled。 */
    async function settleRefundOrder(orderId: string): Promise<void> {
        const orderInfo = (await adminClient.query(gql`
            query($id: ID!){ order(id:$id){ id payments{ id } lines{ id quantity } } }
        `, { id: orderId })) as any;
        const paymentId = orderInfo.order.payments[0].id;
        const refund = (await adminClient.query(gql`
            mutation($input: RefundOrderInput!){
                refundOrder(input:$input){
                    ... on Refund { id state }
                    ... on ErrorResult { errorCode message }
                }
            }
        `, {
            input: {
                lines: orderInfo.order.lines.map((l: any) => ({ orderLineId: l.id, quantity: l.quantity })),
                shipping: 0,
                adjustment: 0,
                paymentId,
            },
        })) as any;
        const refundId = refund.refundOrder.id;
        let state = refund.refundOrder.state as string;
        if (state !== 'Settled') {
            const settle = (await adminClient.query(gql`
                mutation($input: SettleRefundInput!){
                    settleRefund(input:$input){
                        ... on Refund { id state }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `, { input: { id: refundId, transactionId: 'rf-1' } })) as any;
            state = settle.settleRefund.state;
        }
        expect(state).toBe('Settled');
    }

    // ---------- DB helpers ----------

    async function entriesForOrder(orderId: string): Promise<AffiliateCommissionEntry[]> {
        const tconn = server.app.get(TransactionalConnection);
        const repo = tconn.rawConnection.getRepository(AffiliateCommissionEntry);
        return repo.find({ where: { orderId: numericId(orderId) }, order: { id: 'ASC' } } as any);
    }

    async function promoRow(): Promise<Affiliate | null> {
        const tconn = server.app.get(TransactionalConnection);
        return tconn.rawConnection.getRepository(Affiliate).findOne({ where: { code: codePromo } } as any);
    }

    /** 推广员 promo 真实可提现（可提现口径 = pending 佣金 - 已支付提现）。 */
    async function availableBalancePromo(): Promise<number> {
        const aff = await promoRow();
        if (!aff) return 0;
        const tconn = server.app.get(TransactionalConnection);
        const ce = await tconn.rawConnection.getRepository(AffiliateCommissionEntry);
        const pend = (await ce.find({ where: { affiliateId: aff.id, status: 'pending' } } as any))
            .reduce((s, r) => s + Number(r.commissionAmount ?? 0), 0);
        const wd = await tconn.rawConnection.getRepository(AffiliateWithdrawal);
        const paid = (await wd.find({ where: { affiliateId: aff.id, status: 'paid' } } as any))
            .reduce((s, r) => s + Number(r.amount ?? 0), 0);
        return Math.max(0, pend - paid);
    }

    async function orderLineProrated(orderId: string): Promise<number> {
        const r = (await adminClient.query(gql`
            query($id: ID!){ order(id:$id){ lines { id proratedLinePriceWithTax } } }
        `, { id: orderId })) as any;
        return r.order.lines[0].proratedLinePriceWithTax as number;
    }

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: singleStageRefundablePaymentMethod.code,
                        handler: { code: singleStageRefundablePaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        shopAId = await createShop('Shop A', 'shop-a');
        await provisionOwner(shopAId, ownerEmail);
        ownerClient = await asOwner(ownerEmail);

        // 顾客：promo(推广员A) / main(推广员B) / buyer(好友) / buyer2(好友2)
        for (const email of [promoEmail, mainEmail, buyerEmail, buyer2Email]) {
            await adminClient.query(gql`
                mutation { createCustomer(input: { firstName: "F", lastName: "F", emailAddress: "${email}" }, password: "test") { ... on Customer { id } } }
            `);
        }

        promoClient = new SimpleGraphQLClient(config, shopApiUrl);
        await promoClient.asUserWithCredentials(promoEmail, 'test');
        mainAffClient = new SimpleGraphQLClient(config, shopApiUrl);
        await mainAffClient.asUserWithCredentials(mainEmail, 'test');
        buyer2Client = new SimpleGraphQLClient(config, shopApiUrl);
        await buyer2Client.asUserWithCredentials(buyer2Email, 'test');
        await shopClient.asUserWithCredentials(buyerEmail, 'test');

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const pd = await createProduct('分销默认商品', 'aff-default', taxCategoryId);
        const pr = await createProduct('分销费率商品', 'aff-rated', taxCategoryId, '{ affiliateRate: 100 }');
        variantDefaultId = pd.variantId;
        variantRatedId = pr.variantId;
        await assign(shopAId, [pd.productId, pr.productId]);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('1 用户 becomeAffiliate 生成唯一 code（支持带/不带 shopId）', async () => {
        const rP = (await promoClient.query(gql`mutation { becomeAffiliate { id shopId code status } }`)) as any;
        expect(rP.becomeAffiliate.status).toBe('active');
        expect(rP.becomeAffiliate.code.length).toBeGreaterThan(0);
        expect(rP.becomeAffiliate.shopId).toBeNull();
        codePromo = rP.becomeAffiliate.code;

        const rM = (await mainAffClient.query(gql`mutation($sid: ID){ becomeAffiliate(shopId: $sid) { id shopId code status } }`, { sid: shopAId })) as any;
        expect(rM.becomeAffiliate.shopId).toBe(shopAId);
        codeMain = rM.becomeAffiliate.code;
        expect(codeMain).not.toBe(codePromo);
    });

    it('2 绑定 click：buyer 绑成功；重复绑抛 Already bound；自绑抛 Cannot bind to yourself', async () => {
        const rel = (await shopClient.query(
            gql`mutation($c: String!){ bindAffiliate(code: $c, source: "click") { id affiliateId customerId bindSource } }`,
            { c: codePromo },
        )) as any;
        expect(rel.bindAffiliate.bindSource).toBe('click');

        await assertThrowsWithMessage(
            () => shopClient.query(gql`mutation($c: String!){ bindAffiliate(code: $c) { id } }`, { c: codePromo }),
            'Already bound',
        );
        await assertThrowsWithMessage(
            () => promoClient.query(gql`mutation($c: String!){ bindAffiliate(code: $c) { id } }`, { c: codePromo }),
            'Cannot bind to yourself',
        );
    });

    it('3 好友下单送达 Delivered → 生成 pending 佣金(rate=30, loadOn=platform)，幂等不重复', async () => {
        const oid = await createPaidOrder(variantDefaultId, 1);
        await transitionOrderTo(oid, 'Delivered');
        await waitFor(async () => (await entriesForOrder(oid)).length === 1);
        let es = await entriesForOrder(oid);
        expect(es).toHaveLength(1);
        const e = es[0];
        const base = await orderLineProrated(oid);
        expect(e.baseAmount).toBe(base);
        expect(e.rate).toBe(30);
        expect(e.status).toBe('pending');
        expect(e.loadOn).toBe('platform');
        expect(e.shopId).toBe(numericId(shopAId));
        expect(e.commissionAmount).toBe(Math.round((base * 30) / 1000));
        c3 = e.commissionAmount;

        // 幂等：直接再触发 service.getOrCreateCommissions 不再新增
        const service = server.app.get(AffiliateService);
        const rcs = server.app.get(RequestContextService);
        const ctx = await rcs.create({ apiType: 'admin' });
        await service.getOrCreateCommissions(ctx, { id: numericId(oid) } as any);
        es = await entriesForOrder(oid);
        expect(es).toHaveLength(1);
    });

    it('4 商品级费率：affiliateRate=100(10%) 覆盖 defaultRate', async () => {
        const oid = await createPaidOrder(variantRatedId, 1);
        ratedOrderId = oid;
        await transitionOrderTo(oid, 'Delivered');
        await waitFor(async () => (await entriesForOrder(oid)).length === 1);
        const e = (await entriesForOrder(oid))[0];
        const base = await orderLineProrated(oid);
        expect(e.baseAmount).toBe(base);
        expect(e.rate).toBe(100);
        expect(e.commissionAmount).toBe(Math.round((base * 100) / 1000));
        expect(e.loadOn).toBe('platform');
        c4 = e.commissionAmount;
    });

    it('5 商品退款到 Refund Settled → 佣金置 reversed，推广员余额回滚', async () => {
        const oid = await createPaidOrder(variantDefaultId, 1);
        await transitionOrderTo(oid, 'Delivered');
        await waitFor(async () => (await entriesForOrder(oid)).length === 1);
        const e = (await entriesForOrder(oid))[0];
        expect(e.status).toBe('pending');
        c5 = e.commissionAmount;
        const before = (await promoRow())?.withdrawableCommission ?? 0;

        await settleRefundOrder(oid);
        await waitFor(async () => (await entriesForOrder(oid))[0]?.status === 'reversed');

        expect((await entriesForOrder(oid))[0].status).toBe('reversed');
        const after = (await promoRow())?.withdrawableCommission ?? 0;
        expect(before - after).toBe(c5);
    });

    it('6 余额守恒与提现：正常金额成功 pending；超余额抛 exceeds available balance', async () => {
        const aff = (await promoClient.query(MY_AFFILIATE)) as any;
        expect(aff.myAffiliate.totalCommission).toBe(c3 + c4 + c5);
        expect(aff.myAffiliate.withdrawableCommission).toBe(c3 + c4);

        const avail = await availableBalancePromo();
        expect(avail).toBe(c3 + c4);
        await assertThrowsWithMessage(
            () => promoClient.query(gql`mutation($a: Int!){ requestWithdrawal(amount: $a) { id status } }`, { a: avail + 1 }),
            'exceeds available balance',
        );
        const wd = (await promoClient.query(gql`mutation($a: Int!){ requestWithdrawal(amount: $a) { id status amount } }`, { a: 1 })) as any;
        expect(wd.requestWithdrawal.status).toBe('pending');
        expect(wd.requestWithdrawal.amount).toBe(1);
        wd1Id = String(wd.requestWithdrawal.id);
    });

    it('7 提现打款/驳回：payWithdrawal→paid；rejectWithdrawal→rejected 且回放余额', async () => {
        // 店主支付 wd1 → paid
        const pay = (await ownerClient.query(gql`mutation($id: ID!){ payWithdrawal(id: $id) { id status } }`, { id: wd1Id })) as any;
        expect(pay.payWithdrawal.status).toBe('paid');

        // 再申请一笔 1 并驳回
        const wd2 = (await promoClient.query(gql`mutation($a: Int!){ requestWithdrawal(amount: $a) { id status } }`, { a: 1 })) as any;
        const reject = (await ownerClient.query(gql`mutation($id: ID!){ rejectWithdrawal(id: $id) { id status } }`, { id: wd2.requestWithdrawal.id })) as any;
        expect(reject.rejectWithdrawal.status).toBe('rejected');

        // 驳回后余额回放：可提现 = pending(c3+c4) - paid(1)
        expect((await promoRow())?.withdrawableCommission).toBe(c3 + c4 - 1);
        expect(await availableBalancePromo()).toBe(c3 + c4 - 1);
    });

    it('8 越权隔离：A 的 myCommissionEntries 见不到 B 的；非推广员 myAffiliate 为 null', async () => {
        // B(main) 的绑定顾客 buyer2 下单送达 → B 得佣金
        await buyer2Client.query(gql`mutation($c: String!){ bindAffiliate(code: $c, source: "code") { id } }`, { c: codeMain });
        const oid = await createPaidOrder(variantDefaultId, 1, buyer2Client);
        await transitionOrderTo(oid, 'Delivered');
        await waitFor(async () => (await entriesForOrder(oid)).length === 1);

        const aEntries = (await promoClient.query(MY_ENTRIES)) as any;
        const bEntries = (await mainAffClient.query(MY_ENTRIES)) as any;
        expect(bEntries.myCommissionEntries.some((x: any) => String(x.orderId) === String(oid))).toBe(true);
        expect(aEntries.myCommissionEntries.some((x: any) => String(x.orderId) === String(oid))).toBe(false);
        // 各自只看到自己的 affiliateId
        const aAff = (await promoClient.query(MY_AFFILIATE)) as any;
        const bAff = (await mainAffClient.query(MY_AFFILIATE)) as any;
        for (const x of aEntries.myCommissionEntries) {
            expect(String(x.affiliateId)).toBe(String(aAff.myAffiliate.id));
        }
        for (const x of bEntries.myCommissionEntries) {
            expect(String(x.affiliateId)).toBe(String(bAff.myAffiliate.id));
        }

        // 非推广员（buyer2 仅绑定、非 affiliate）myAffiliate 为 null
        const nr = (await buyer2Client.query(MY_AFFILIATE)) as any;
        expect(nr.myAffiliate).toBeNull();
    });

    it('9 渠道隔离：新 channel 的 affiliates 为空', async () => {
        const dflt = (await adminClient.query(gql`query { affiliates { id } }`)) as any;
        expect(dflt.affiliates.length).toBeGreaterThanOrEqual(2);

        const zones = (await adminClient.query(gql`query { zones { items { id } } }`)) as any;
        const zoneId = zones.zones.items[0].id;
        const ch = (await adminClient.query(gql`
            mutation {
                createChannel(input: {
                    code: "affiliate-channel-b"
                    token: "affiliate-channel-b"
                    defaultLanguageCode: en
                    currencyCode: USD
                    pricesIncludeTax: true
                    defaultTaxZoneId: "${zoneId}"
                    defaultShippingZoneId: "${zoneId}"
                }) {
                    ... on Channel { id token }
                    ... on ErrorResult { errorCode message }
                }
            }
        `)) as any;
        const tokenB = ch.createChannel.token as string;
        const prevToken = await currentChannelToken();
        adminClient.setChannelToken(tokenB);
        const empty = (await adminClient.query(gql`query { affiliates { id } }`)) as any;
        expect(empty.affiliates).toHaveLength(0);
        adminClient.setChannelToken(prevToken);
    });

    it('10 幂等 getOrCreate：重复触发不重复生成（数量=订单行数）', async () => {
        // 用商品级费率订单(4)复测：行数=1，重复触发不新增
        const before = await entriesForOrder(ratedOrderId);
        expect(before).toHaveLength(1);

        const service = server.app.get(AffiliateService);
        const rcs = server.app.get(RequestContextService);
        const ctx = await rcs.create({ apiType: 'admin' });
        await service.getOrCreateCommissions(ctx, { id: numericId(ratedOrderId) } as any);

        // 再次触发，仍为 1 条
        await service.getOrCreateCommissions(ctx, { id: numericId(ratedOrderId) } as any);
        const after = await entriesForOrder(ratedOrderId);
        expect(after).toHaveLength(1);
        expect(String(after[0].id)).toBe(String(before[0].id));
        // 无重复入账（余额不多算）
        expect((await promoRow())?.withdrawableCommission).toBe(c3 + c4 - 1);
    });

    async function currentChannelToken(): Promise<string> {
        const dflt = (await adminClient.query(gql`query { activeChannel { token } }`)) as any;
        return dflt.activeChannel?.token ?? '';
    }
});