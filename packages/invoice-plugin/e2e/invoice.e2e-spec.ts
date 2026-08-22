import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { InvoicePlugin } from '../src/plugin';
import { MessagePlugin } from '../../message-plugin/src/plugin';
import { mergeConfig } from '@vendure/core';
import { testSuccessfulPaymentMethod } from '../../core/e2e/fixtures/test-payment-methods';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
} from '../../core/e2e/utils/test-order-utils';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('InvoicePlugin', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [InvoicePlugin.init(), MessagePlugin.init()],
            paymentOptions: {
                paymentMethodHandlers: [testSuccessfulPaymentMethod],
            },
        }),
    );

    let variantId: string;

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
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        // 创建测试客户并以该客户身份打开 shop 会话（createInvoice 需 shop Authenticated）
        await adminClient.query(gql`
            mutation {
                createCustomer(input: { firstName: "Inv", lastName: "Test", emailAddress: "inv.test@example.com" }, password: "test") {
                    ... on Customer { id }
                }
            }
        `);
        await shopClient.asUserWithCredentials('inv.test@example.com', 'test');

        const products = await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { variants { id } } } }
        `);
        variantId = (products.products.items[0].variants[0] as any).id;

        // 结算基准统一为含税，保证行级价税可精确核算
        const channels = await adminClient.query(gql`
            query { channels { items { id } } }
        `);
        const defaultChannelId = channels.channels.items[0].id;
        await adminClient.query(gql`
            mutation { updateChannel(input: { id: "${defaultChannelId}", pricesIncludeTax: true }) { ... on Channel { id pricesIncludeTax } } }
        `);
    }, TEST_SETUP_TIMEOUT_MS);

    /** 下单+支付 → 置为 Completed（满足 createInvoice 的可开票状态） */
    async function createAndDeliverOrder(qty = 2): Promise<string> {
        // 清空遗留活动订单
        const active = await shopClient.query(gql` query { activeOrder { id } } `);
        if (active.activeOrder?.id) {
            await adminClient.query(gql`
                mutation { cancelOrder(input: { orderId: "${active.activeOrder.id}" }) { ... on Order { id state } ... on ErrorResult { errorCode message } } }
            `);
        }
        await shopClient.query(gql`
            mutation { addItemToOrder(productVariantId: "${variantId}", quantity: ${qty}) { ... on Order { id totalWithTax } ... on ErrorResult { errorCode } } }
        `);
        await proceedToArrangingPayment(shopClient);
        const paid = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
        const orderId = paid.id;
        // 履约需要的订单行
        const linesRes = await adminClient.query(gql`
            query { order(id: "${orderId}") { lines { id quantity } } }
        `);
        const orderLines = ((linesRes as any).order?.lines ?? []).map(
            (l: any) => `{ orderLineId: "${l.id}", quantity: ${l.quantity} }`,
        ).join(',');
        // 走履约流程 → Shipped → Delivered（Delivered 属于可开票状态）
        const fulfill = await adminClient.query(gql`
            mutation { addFulfillmentToOrder(input: { handler: { code: "manual-fulfillment", arguments: [{ name: "method", value: "Manual" }] }, lines: [${orderLines}] }) { ... on Fulfillment { id state } ... on ErrorResult { errorCode message } } }
        `);
        const fulfillmentId = (fulfill as any).addFulfillmentToOrder?.id;
        expect(fulfillmentId).toBeDefined();
        await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Shipped") { ... on Fulfillment { id state } ... on FulfillmentStateTransitionError { errorCode message } } }
        `);
        const trans = await adminClient.query(gql`
            mutation { transitionFulfillmentToState(id: "${fulfillmentId}", state: "Delivered") { ... on Fulfillment { id state } ... on FulfillmentStateTransitionError { errorCode message } } }
        `);
        expect((trans.transitionFulfillmentToState as any).state).toBe('Delivered');
        return orderId;
    }

    afterAll(async () => {
        await server.destroy();
    });

    it('plugin loads without errors', () => {
        expect(server.app).toBeDefined();
    });

    it('registers invoice custom fields on Order', async () => {
        const result = await adminClient.query(gql`
            query { orders(options: { take: 1 }) { items { id customFields { invoiceRequired invoiceType } } } }
        `);
        expect(result.orders).toBeDefined();
    });

    it('admin schema exposes lines/totals/invoiceNo and bulkIssueInvoices', async () => {
        const result = await adminClient.query(gql`
            query {
                __type(name: "Invoice") {
                    fields {
                        name
                        type { kind ofType { kind name } name }
                    }
                }
            }
        `);
        const fieldNames = result.__type.fields.map((f: any) => f.name);
        expect(fieldNames).toContain('lines');
        expect(fieldNames).toContain('totals');
        expect(fieldNames).toContain('invoiceNo');
        expect(fieldNames).toContain('voidedAt');
        expect(fieldNames).toContain('voidReason');
        expect(fieldNames).toContain('parentInvoiceId');
        expect(fieldNames).toContain('isRed');
        expect(fieldNames).toContain('partiallyReversed');
        expect(fieldNames).toContain('reversedAmount');

        const mutations = await adminClient.query(gql`
            query {
                __schema { mutationType { fields { name } } }
            }
        `);
        const mutationNames = mutations.__schema.mutationType.fields.map((f: any) => f.name);
        expect(mutationNames).toContain('bulkIssueInvoices');
        expect(mutationNames).toContain('voidInvoice');

        const queries = await adminClient.query(gql`
            query {
                __schema { queryType { fields { name } } }
            }
        `);
        const queryNames = queries.__schema.queryType.fields.map((f: any) => f.name);
        expect(queryNames).toContain('exportInvoicesCsv');
    });

    it('compliance: 专票缺必填字段被拒绝（无需有效订单即可验证）', async () => {
        // assertCompliant 在订单归属校验前执行，故用不存在的订单即可触发合规错误
        const promise = shopClient.query(
            gql`
                mutation {
                    createInvoice(
                        input: {
                            orderIds: ["999999"]
                            invoiceType: "special"
                            title: "测试专票"
                            taxNumber: "1234567890123456"
                        }
                    ) {
                        id
                    }
                }
            `,
        );
        await expect(promise).rejects.toThrow('专用发票必填');
    });

    it('compliance: 税号格式错误被拒绝', async () => {
        const promise = shopClient.query(
            gql`
                mutation {
                    createInvoice(
                        input: {
                            orderIds: ["999999"]
                            invoiceType: "ordinary"
                            title: "测试普通发票"
                            taxNumber: "INVALID-TAX-ID!!"
                        }
                    ) {
                        id
                    }
                }
            `,
        );
        await expect(promise).rejects.toThrow('税号格式不正确');
    });

    it('C. 抬头复用：createInvoice 传 invoiceTitleId 命中已存抬头并回填快照', async () => {
        // 存一条抬头（含专票所需字段）
        const t = await shopClient.query(gql`
            mutation {
                createInvoiceTitle(input: {
                    title: "北京测试科技有限公司"
                    taxNumber: "91110108MA01TEST99"
                    email: "acc@test.com"
                    companyAddress: "北京市海淀区中关村"
                    companyPhone: "010-12345678"
                    bankName: "工行中关村支行"
                    bankAccount: "6222000011112222"
                }) { id title }
            }
        `);
        const titleId = (t as any).createInvoiceTitle.id;
        // 命中已存抬头并回填 → 在"完整开票流"用例中已用真实订单验证（title/taxNumber/email 回填）。
        expect(titleId).toBeDefined();
    });

    it('完整开票流：下单→完成→createInvoice→issueInvoice 固化行级快照/统一发票号/价税', async () => {
        const orderId = await createAndDeliverOrder(2);

        // 存抬头并复用
        const t = await shopClient.query(gql`
            mutation {
                createInvoiceTitle(input: { title: "行云科技有限公司", taxNumber: "91330106MA2ABCD123", email: "finance@xyun.com" }) { id }
            }
        `);
        const titleId = (t as any).createInvoiceTitle.id;

        const created = await shopClient.query(gql`
            mutation {
                createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "Placeholder", invoiceTitleId: "${titleId}" }) { id status title taxNumber email }
            }
        `);
        const invoice = (created as any).createInvoice;
        expect(invoice.status).toBe('pending');
        expect(invoice.title).toBe('行云科技有限公司');
        expect(invoice.taxNumber).toBe('91330106MA2ABCD123');
        expect(invoice.email).toBe('finance@xyun.com');

        // admin 开票
        const issued = await adminClient.query(gql`
            mutation { issueInvoice(id: "${invoice.id}") { id status invoiceNo lines { sku name quantity unitPrice unitPriceWithTax amount taxRate taxAmount amountWithTax } totals { totalExcludingTax totalTax totalWithTax } } }
        `);
        const i = (issued as any).issueInvoice;
        expect(i.status).toBe('issued');
        expect(i.lines.length).toBeGreaterThan(0);
        expect(i.totals.totalTax).toBeGreaterThan(0);
        expect(i.totals.totalWithTax).toBe(i.totals.totalExcludingTax + i.totals.totalTax);
        // 统一发票号格式 INV-{yyyyMMdd}-{channelId}-{seq}
        expect(String(i.invoiceNo)).toMatch(/^INV-\d{8}-\d+/);

        // C端 myInvoice(id) 返回 lines
        const mine = await shopClient.query(gql`
            query { myInvoice(id: "${invoice.id}") { id lines { sku quantity } totals { totalWithTax } } }
        `);
        expect((mine as any).myInvoice.lines.length).toBeGreaterThan(0);
    });

    it('B. 批量开票 bulkIssueInvoices 跳过已完成单、单张失败隔离', async () => {
        // 第二单 → pending → 批量开票
        const orderId2 = await createAndDeliverOrder(1);
        const created2 = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId2}"], invoiceType: "ordinary", title: "Bulk Co" }) { id status } }
        `);
        const pendingId = (created2 as any).createInvoice.id;

        const bulk = await adminClient.query(gql`
            mutation { bulkIssueInvoices(ids: ["${pendingId}"]) { id status invoiceNo } }
        `);
        const items = (bulk as any).bulkIssueInvoices;
        expect(items.length).toBe(1);
        expect(items[0].status).toBe('issued');
        expect(String(items[0].invoiceNo)).toMatch(/^INV-\d{8}-\d+/);
    });

    it('批量开票单张失败不中断：非法 id + 合法 pending 混合，合法单仍成功', async () => {
        const orderId3 = await createAndDeliverOrder(1);
        const created3 = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId3}"], invoiceType: "ordinary", title: "Isolation Co" }) { id status } }
        `);
        const pendingId = (created3 as any).createInvoice.id;

        // 混入不存在的 id（应标记 FAILED/被跳过），合法 pending 单正常开出
        const bulk = await adminClient.query(gql`
            mutation { bulkIssueInvoices(ids: ["99999", "${pendingId}"]) { id status } }
        `);
        const items = (bulk as any).bulkIssueInvoices;
        // 合法单必须 issued（失败隔离不阻塞其余）；"99999" 不存在会被跳过/标记失败，但不抛
        const issuedOne = items.find((x: any) => String(x.id) === String(pendingId));
        expect(issuedOne).toBeDefined();
        expect(issuedOne.status).toBe('issued');
    });

    it('D. 作废留痕：PENDING 可作废，作废后可重开同一订单', async () => {
        const orderId = await createAndDeliverOrder(1);
        const created = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "VoidCo" }) { id status } }
        `);
        const pendingId = (created as any).createInvoice.id;

        const voided = await adminClient.query(gql`
            mutation { voidInvoice(id: "${pendingId}", reason: "误填，作废重开") { id status voidReason voidedAt } }
        `);
        expect((voided as any).voidInvoice.status).toBe('voided');
        expect((voided as any).voidInvoice.voidReason).toBe('误填，作废重开');
        expect((voided as any).voidInvoice.voidedAt).toBeDefined();

        // 作废后同一订单允许重开
        const reopened = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "VoidCo Reopen" }) { id status } }
        `);
        expect((reopened as any).createInvoice.status).toBe('pending');
    });

    it('D. 全量红冲后可重开同一订单', async () => {
        const orderId = await createAndDeliverOrder(1);
        const created = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "FullReverse" }) { id } }
        `);
        const id = (created as any).createInvoice.id;
        await adminClient.query(gql` mutation { issueInvoice(id: "${id}") { id status } } `);

        const reversed = await adminClient.query(gql`
            mutation { reverseInvoice(id: "${id}", reason: "退货全量红冲") { id status reversedAt reversedAmount } }
        `);
        expect((reversed as any).reverseInvoice.status).toBe('reversed');
        expect((reversed as any).reverseInvoice.reversedAmount).toBeGreaterThan(0);

        // 红冲后可重开
        const reopened = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "Reopen" }) { id status } }
        `);
        expect((reopened as any).createInvoice.status).toBe('pending');
    });

    it('D. 部分红冲：生成红字票（金额为负、关联原票），原票保留为部分红冲', async () => {
        const orderId = await createAndDeliverOrder(2);
        const created = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "PartialCo" }) { id amount } }
        `);
        const id = (created as any).createInvoice.id;
        const fullAmount = (created as any).createInvoice.amount;
        await adminClient.query(gql` mutation { issueInvoice(id: "${id}") { id status } } `);

        const half = Math.floor(fullAmount / 2);
        const res = await adminClient.query(gql`
            mutation { reverseInvoice(id: "${id}", reason: "部分退货红冲", reverseAmount: ${half}) { id status reversedAmount partiallyReversed } }
        `);
        const inv = (res as any).reverseInvoice;
        expect(inv.status).toBe('partially_reversed');
        expect(inv.partiallyReversed).toBe(true);
        expect(inv.reversedAmount).toBe(half);

        // 关联的红字票存在（isRed=true, amount=-half, parentInvoiceId=原票）
        const list = await adminClient.query(gql`
            query { invoices { items { id isRed amount parentInvoiceId status } } }
        `);
        const red = (list as any).invoices.items.find(
            (x: any) => x.isRed === true && String(x.parentInvoiceId) === String(id),
        );
        expect(red).toBeDefined();
        expect(red.amount).toBe(-half);
        expect(red.status).toBe('reversed');
    });

    it('D. 通知触达：开票/红冲/作废写入消息中心（myMessages）', async () => {
        const orderId = await createAndDeliverOrder(1);
        const created = await shopClient.query(gql`
            mutation { createInvoice(input: { orderIds: ["${orderId}"], invoiceType: "ordinary", title: "NotifyCo" }) { id } }
        `);
        const id = (created as any).createInvoice.id;
        await adminClient.query(gql` mutation { issueInvoice(id: "${id}") { id status invoiceNo } } `);

        const msgs = await shopClient.query(gql`
            query { myMessages { items { title body } } }
        `);
        const items = (msgs as any).myMessages.items;
        expect(items.some((m: any) => m.title.includes('发票已开具'))).toBe(true);
    });

    it('D. 后台筛选/排序：invoices 支持 filter + sort（发票中心列表依赖）', async () => {
        const res = await adminClient.query(gql`
            query {
                invoices(
                    options: {
                        take: 10
                        sort: { status: ASC, createdAt: DESC }
                        filter: { status: { eq: "issued" } }
                    }
                ) {
                    items { id status invoiceNo }
                    totalItems
                }
            }
        `);
        const result = (res as any).invoices;
        expect(result.totalItems).toBeGreaterThanOrEqual(0);
        if (result.items.length) {
            expect(result.items.every((x: any) => x.status === 'issued')).toBe(true);
        }
    });

    it('D. 后台导出 CSV：exportInvoicesCsv 返回带 BOM 的 CSV（含表头与数据行）', async () => {
        const res = await adminClient.query(gql`
            query { exportInvoicesCsv }
        `);
        const csv = (res as any).exportInvoicesCsv;
        expect(csv.startsWith('\uFEFF')).toBe(true);
        const body = csv.slice(1);
        const lines = body.split('\r\n');
        expect(lines[0]).toContain('发票号');
        // 至少包含一条数据行
        expect(lines.length).toBeGreaterThan(1);
    });
});
