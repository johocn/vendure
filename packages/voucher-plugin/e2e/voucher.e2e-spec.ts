import { mergeConfig, RequestContextService, TransactionalConnection } from '@vendure/core';
import {
    createTestEnvironment,
    registerInitializer,
    SimpleGraphQLClient,
    SqljsInitializer,
} from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ShopPlugin } from '@vendure/shop-plugin';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { assertThrowsWithMessage } from '../../core/e2e/utils/assert-throws-with-message';
import { addPaymentToOrder, proceedToArrangingPayment } from '../../core/e2e/utils/test-order-utils';
import { singleStageRefundablePaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';

import { ServiceVoucher } from '../src/service-voucher.entity';
import { VoucherPlugin } from '../src/voucher.plugin';
import { VoucherService } from '../src/voucher.service';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/** 简单的轮询帮助函数（PaymentSettled/Refund Settled 事件订阅 → 异步落库，需轮询等待）。 */
async function waitFor(fn: () => Promise<boolean>, timeoutMs = 6000, intervalMs = 100): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await fn()) return;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor timeout');
}

const MS_PER_DAY = 86400000;
const DEFAULT_EFFECTIVE_DAYS = 90;

/** 测试 EntityIdStrategy 会给 ID 加 `T_` 前缀；原始仓库查询需还原纯数字 id。 */
function numericId(encoded: string | number): number {
    return Number(String(encoded).replace(/^T_/, ''));
}

describe('VoucherPlugin · 阶段28 到店服务券全链路', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShopPlugin.init({}), VoucherPlugin.init({})],
        paymentOptions: {
            paymentMethodHandlers: [singleStageRefundablePaymentMethod],
        },
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    const adminApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.adminApiPath}`;
    const shopApiUrl = `http://localhost:${config.apiOptions.port}/${config.apiOptions.shopApiPath}`;

    const mainEmail = 'main.vow@test.com';
    const otherEmail = 'other.vow@test.com';
    const ownerEmail = 'ownerA.vow@test.com';

    let shopAId: string;
    let variantAId: string;
    let mainOrderId: string;
    let ownerClient: SimpleGraphQLClient;

    const MY_VOUCHERS = gql`
        query {
            myVouchers {
                id
                orderId
                code
                status
                effectiveDays
                expiresAt
            }
        }
    `;
    const MY_VOUCHERS_ADMIN = gql`
        query {
            myVouchersAdmin {
                id
                code
                status
            }
        }
    `;

    async function asOwner(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, adminApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    async function asCustomer(email: string): Promise<SimpleGraphQLClient> {
        const c = new SimpleGraphQLClient(config, shopApiUrl);
        await c.asUserWithCredentials(email, 'test');
        return c;
    }

    async function createShop(name: string, slug: string): Promise<string> {
        const res = (await adminClient.query(gql`
            mutation {
                createShop(input: { name: "${name}", slug: "${slug}", description: "test shop" }) { id name status }
            }
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

    async function createProduct(name: string, slug: string, taxCategoryId: string): Promise<{ productId: string; variantId: string }> {
        const p = (await adminClient.query(gql`
            mutation {
                createProduct(input: {
                    translations: [{ languageCode: en, name: "${name}", slug: "${slug}", description: "${name} desc" }]
                    customFields: { serviceType: "VOUCHER" }
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

    async function resetActiveOrder(): Promise<void> {
        try {
            await shopClient.query(gql`mutation { removeAllOrderLines { ... on Order { id } } }`);
        } catch {
            // no active order → ignore
        }
    }

    /** 下单并付款（singleStage）→ PaymentSettled。返回 orderId。 */
    async function createPaidOrder(variantId: string, qty = 1): Promise<string> {
        await resetActiveOrder();
        await shopClient.query(gql`
            mutation {
                addItemToOrder(productVariantId: "${variantId}", quantity: ${qty}) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, singleStageRefundablePaymentMethod);
        expect(paid.id).toBeDefined();
        return String(paid.id);
    }

    async function vouchersForOrder(orderId: string): Promise<ServiceVoucher[]> {
        const tconn = server.app.get(TransactionalConnection);
        const repo = tconn.rawConnection.getRepository(ServiceVoucher);
        return repo.find({ where: { orderId: numericId(orderId) }, order: { id: 'ASC' } } as any);
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

        // 顾客：main 下单购券；other 用于隔离开断言。
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "M", lastName: "Vow", emailAddress: "${mainEmail}" }, password: "test") { ... on Customer { id } } }
        `);
        await adminClient.query(gql`
            mutation { createCustomer(input: { firstName: "O", lastName: "Th", emailAddress: "${otherEmail}" }, password: "test") { ... on Customer { id } } }
        `);
        await shopClient.asUserWithCredentials(mainEmail, 'test');

        const taxCats = (await adminClient.query(gql`query { taxCategories { items { id } } }`)) as any;
        const taxCategoryId = taxCats.taxCategories.items[0].id;
        const prod = await createProduct('到店服务券商品', 'service-voucher', taxCategoryId);
        variantAId = prod.variantId;
        await adminClient.query(gql`
            mutation { assignProductsToShop(input: { shopId: "${shopAId}", productIds: ["${prod.productId}"] }) }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('案例1 服务型商品下单支付后自动生成 ServiceVoucher', async () => {
        mainOrderId = await createPaidOrder(variantAId, 2);
        await waitFor(async () => (await vouchersForOrder(mainOrderId)).length === 2);
        const vs = await vouchersForOrder(mainOrderId);
        expect(vs).toHaveLength(2);
        for (const v of vs) {
            expect(v.code?.length).toBeGreaterThan(0);
            expect(v.orderId).toBe(numericId(mainOrderId));
            expect(v.productVoucherName).toBe('到店服务券商品');
            expect(v.effectiveDays).toBe(DEFAULT_EFFECTIVE_DAYS);
            expect(v.status).toBe('usable');
        }
    });

    it('案例2 生成幂等：同单再触发不新增（数量=件数）', async () => {
        expect((await vouchersForOrder(mainOrderId)).length).toBe(2);
        const service = server.app.get(VoucherService);
        const rcs = server.app.get(RequestContextService);
        const ctx = await rcs.create({ apiType: 'admin' });
        await service.getOrCreateVouchersForOrder(ctx, { id: numericId(mainOrderId) } as any);
        expect((await vouchersForOrder(mainOrderId)).length).toBe(2);
    });

    it('案例3 shop myVouchers 仅见本人（含状态/有效期/code）；他人查不到', async () => {
        const mine = (await shopClient.query(MY_VOUCHERS)) as any;
        expect(mine.myVouchers.length).toBe(2);
        for (const v of mine.myVouchers) {
            expect(['usable', 'used']).toContain(v.status);
            expect(v.expiresAt).toBeDefined();
            expect(v.code.length).toBeGreaterThan(0);
        }
        const other = await asCustomer(otherEmail);
        const theirs = (await other.query(MY_VOUCHERS)) as any;
        expect(theirs.myVouchers).toHaveLength(0);
    });

    it('案例4 admin scanVoucher(code) 返回该券', async () => {
        const vs = await vouchersForOrder(mainOrderId);
        const code = vs[0].code as string;
        const r = (await ownerClient.query(gql`query($c:String!){ scanVoucher(code:$c){ id code status } }`, { c: code })) as any;
        expect(r.scanVoucher).toBeDefined();
        expect(r.scanVoucher.code).toBe(code);
    });

    it('案例5 redeemVoucher usable→used+usedAt；再次核销报错', async () => {
        const vs = await vouchersForOrder(mainOrderId);
        const code = vs[0].code as string;
        const r = (await ownerClient.query(gql`mutation($c:String!){ redeemVoucher(code:$c){ code status usedAt } }`, { c: code })) as any;
        expect(r.redeemVoucher.status).toBe('used');
        expect(r.redeemVoucher.usedAt).toBeDefined();
        await assertThrowsWithMessage(
            () => ownerClient.query(gql`mutation($c:String!){ redeemVoucher(code:$c){ id } }`, { c: code }),
            'not usable',
        );
    });

    it('案例6 非店主（无归属 admin）调用 redeem 被 requireMyShop 拒绝', async () => {
        const vs = await vouchersForOrder(mainOrderId);
        const code = vs[1].code as string;
        // superAdmin 有权限通过 schema 门槛，但无归属 shop → requireMyShop 抛 Forbidden
        await assertThrowsWithMessage(
            () => adminClient.query(gql`mutation($c:String!){ redeemVoucher(code:$c){ id } }`, { c: code }),
            'not authorized',
        );
    });

    it('案例7 extendVoucher(voucherId, days) expiresAt 精确延后 days 天', async () => {
        const vs = await vouchersForOrder(mainOrderId);
        const usable = vs.find(v => v.status === 'usable');
        if (!usable) throw new Error('no usable voucher');
        const before = usable.expiresAt as Date;
        const r = (await ownerClient.query(gql`mutation($id:ID!,$d:Int!){ extendVoucher(voucherId:$id, days:$d){ id expiresAt } }`, { id: String((usable.id)), d: 30 })) as any;
        const after = new Date(r.extendVoucher.expiresAt);
        expect(after.getTime() - before.getTime()).toBe(30 * MS_PER_DAY);
    });

    it('案例8 exchangeVoucher 旧券 voided、新券 usable 且 code 不同', async () => {
        const vs = await vouchersForOrder(mainOrderId);
        const usable = vs.find(v => v.status === 'usable');
        if (!usable) throw new Error('no usable voucher');
        const oldCode = usable.code as string;
        const r = (await ownerClient.query(gql`mutation($id:ID!){ exchangeVoucher(voucherId:$id){ id code status } }`, { id: String(usable.id) })) as any;
        expect(r.exchangeVoucher.status).toBe('usable');
        expect(r.exchangeVoucher.code).not.toBe(oldCode);
        const reloaded = (await vouchersForOrder(mainOrderId)).find(v => String(v.id) === String(usable.id));
        expect(reloaded?.status).toBe('voided');
    });

    it('案例9 runExpireScan：usable 且 expiresAt<now → expired', async () => {
        // 找一张 usable 的券（案例8 生成的新券），把 expiresAt 直接置为过去，再扫描
        const all = await rawVouchers();
        const target = all.find(v => v.status === 'usable');
        if (!target) throw new Error('no usable voucher for expiry');
        const tconn = server.app.get(TransactionalConnection);
        await tconn.rawConnection.getRepository(ServiceVoucher).update(target.id, {
            expiresAt: new Date(Date.now() - 1000),
        });
        const r = (await adminClient.query(gql`mutation { runExpireScan }`)) as any;
        expect(r.runExpireScan).toBeGreaterThanOrEqual(1);
        const updated = (await rawVouchers()).find(v => String(v.id) === String(target.id));
        expect(updated?.status).toBe('expired');
    });

    it('案例10 退款联动：退款到 Settled → 该单 usable 券置 refunded', async () => {
        const oid = await createPaidOrder(variantAId, 1);
        await waitFor(async () => (await vouchersForOrder(oid)).length === 1);
        expect((await vouchersForOrder(oid))[0].status).toBe('usable');

        const orderInfo = (await adminClient.query(gql`
            query($id:ID!){ order(id:$id){ id payments{ id } lines{ id quantity } } }
        `, { id: oid })) as any;
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
        await waitFor(async () => (await vouchersForOrder(oid))[0]?.status === 'refunded');
        expect((await vouchersForOrder(oid))[0].status).toBe('refunded');
    });

    it('案例11 预约品类：createBooking 生成 VoucherBooking（幂等一券一档）', async () => {
        const oid = await createPaidOrder(variantAId, 1);
        await waitFor(async () => (await vouchersForOrder(oid)).length === 1);
        const voucher = (await vouchersForOrder(oid))[0];
        const slot = new Date(Date.now() + 3600_000).toISOString();
        const r = (await adminClient.query(gql`
            mutation($id:ID!,$s:DateTime!,$c:Int!){ createBooking(voucherId:$id, slotAt:$s, customerCount:$c){ id voucherId status } }
        `, { id: String(voucher.id), s: slot, c: 2 })) as any;
        expect(r.createBooking.status).toBe('booked');
        expect(numericId(r.createBooking.voucherId)).toBe(voucher.id);
        // 幂等：重复创建返回同一档
        const r2 = (await adminClient.query(gql`
            mutation($id:ID!,$s:DateTime!,$c:Int!){ createBooking(voucherId:$id, slotAt:$s, customerCount:$c){ id } }
        `, { id: String(voucher.id), s: slot, c: 2 })) as any;
        expect(String(r2.createBooking.id)).toBe(String(r.createBooking.id));
        const list = (await adminClient.query(gql`query($id:ID!){ voucherBookings(voucherId:$id){ id status } }`, { id: String(voucher.id) })) as any;
        expect(list.voucherBookings).toHaveLength(1);
    });

    it('案例12 渠道隔离：无券 channel 查询为空', async () => {
        // 主渠道有券
        const dflt = (await adminClient.query(MY_VOUCHERS_ADMIN)) as any;
        expect(dflt.myVouchersAdmin.length).toBeGreaterThanOrEqual(1);
        // 建第二个渠道
        const zones = (await adminClient.query(gql`query { zones { items { id } } }`)) as any;
        const zoneId = zones.zones.items[0].id;
        const ch = (await adminClient.query(gql`
            mutation {
                createChannel(input: {
                    code: "voucher-channel-b"
                    token: "voucher-channel-b"
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
        const empty = (await adminClient.query(MY_VOUCHERS_ADMIN)) as any;
        expect(empty.myVouchersAdmin).toHaveLength(0);
        adminClient.setChannelToken(prevToken);
    });

    async function currentChannelToken(): Promise<string> {
        const dflt = (await adminClient.query(gql`query { activeChannel { token } }`)) as any;
        return dflt.activeChannel?.token ?? '';
    }

    async function rawVouchers(): Promise<ServiceVoucher[]> {
        const tconn = server.app.get(TransactionalConnection);
        return tconn.rawConnection.getRepository(ServiceVoucher).find();
    }
});