// 酒店预订 P1 e2e 探针：加购锁房 → 满房拦截（OrderInterceptorError / HOTEL_SOLD_OUT）→ 释放后可再订
// totalRooms 走 hotelRoomConfig.totalRooms 缺省回退（无 HotelRoomDay 行，Task 3 才有 admin API 建 roomDay）
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CjkPlugin } from '@vendure/cjk-plugin';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

const ROOM_CONFIG = JSON.stringify({ basePriceCent: 30000, totalRooms: 1, minNights: 1 });
const CHECK_IN = '2026-12-01';
const CHECK_OUT = '2026-12-02';
const ALT_IN = '2026-12-05';
const ALT_OUT = '2026-12-06';

// PostgresInitializer / sqljs 每次运行独立建库，固定邮箱不会与 fixtures 冲突
const emailA = 'hotel-a@test.com';
const emailB = 'hotel-b@test.com';

const ADD_ITEM = gql`
    mutation AddItem($variantId: ID!, $in: String!, $out: String!) {
        addItemToOrder(
            productVariantId: $variantId
            quantity: 1
            customFields: { hotelCheckIn: $in, hotelCheckOut: $out, hotelNights: 1 }
        ) {
            ... on Order {
                id
                lines { id quantity customFields { hotelCheckIn hotelCheckOut hotelNights } }
            }
            ... on ErrorResult { __typename errorCode message }
            ... on OrderInterceptorError { __typename errorCode message interceptorError }
        }
    }
`;

describe('Hotel P1 防超订（shop 加购链路）', () => {
    const baseConfig = testConfig();
    const { server, adminClient, shopClient } = createTestEnvironment({
        ...baseConfig,
        importExportOptions: {
            ...baseConfig.importExportOptions,
            importAssetsDir: path.join(__dirname, '../../core/e2e/fixtures/assets'),
        },
        plugins: [
            CjkPlugin.init({
                i18n: { enabled: true },
                regions: { enabled: true },
                tenant: { enabled: true },
            }),
        ],
    });

    let variantId: string;

    beforeAll(async () => {
        await server.init({
            initialData: { ...initialData, paymentMethods: [] },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        for (const email of [emailA, emailB]) {
            await adminClient.query(gql`
                mutation {
                    createCustomer(
                        input: { firstName: "Hotel", lastName: "Tester", emailAddress: "${email}" }
                        password: "test"
                    ) {
                        ... on Customer { id emailAddress }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `);
        }
        const products = (await adminClient.query(gql`
            query { products(options: { take: 1 }) { items { variants { id } } } }
        `)) as any;
        variantId = products.products.items[0].variants[0].id;
        const upd = (await adminClient.query(gql`
            mutation {
                updateProductVariant(input: { id: "${variantId}", customFields: { hotelRoomConfig: ${JSON.stringify(ROOM_CONFIG)} } }) {
                    ... on ProductVariant { id customFields { hotelRoomConfig } }
                }
            }
        `)) as any;
        // 守门：hotelRoomConfig 必须真实写入（totalRooms=1 是后续所有用例的前提）
        expect(JSON.parse(upd.updateProductVariant.customFields.hotelRoomConfig).totalRooms).toBe(1);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('① 客户 A 加购 1 间成功（totalRooms=1 未满）', async () => {
        await shopClient.asUserWithCredentials(emailA, 'test');
        const res = (await shopClient.query(ADD_ITEM, { variantId, in: CHECK_IN, out: CHECK_OUT })) as any;
        expect(res.addItemToOrder.id).toBeDefined();
        expect(res.addItemToOrder.lines[0].customFields.hotelCheckIn).toBe(CHECK_IN);
    }, 60000);

    it('② 客户 B 订同日期被拦截：OrderInterceptorError + HOTEL_SOLD_OUT', async () => {
        await shopClient.asUserWithCredentials(emailB, 'test');
        const res = (await shopClient.query(ADD_ITEM, { variantId, in: CHECK_IN, out: CHECK_OUT })) as any;
        expect(res.addItemToOrder.__typename).toBe('OrderInterceptorError');
        expect(res.addItemToOrder.interceptorError).toContain('HOTEL_SOLD_OUT');
        expect(res.addItemToOrder.interceptorError).toContain(CHECK_IN);
    }, 60000);

    it('③ 客户 B 订不重叠日期成功', async () => {
        const res = (await shopClient.query(ADD_ITEM, { variantId, in: ALT_IN, out: ALT_OUT })) as any;
        expect(res.addItemToOrder.id).toBeDefined();
    }, 60000);

    it('④ 客户 A 移除行释放锁后，客户 B 可再订原日期', async () => {
        await shopClient.asUserWithCredentials(emailA, 'test');
        const order = (await shopClient.query(gql`
            query { activeOrder { lines { id } } }
        `)) as any;
        expect(order.activeOrder).not.toBeNull();
        const lineId = order.activeOrder.lines[0].id;
        const rm = (await shopClient.query(gql`
            mutation RemoveLine($id: ID!) {
                removeOrderLine(orderLineId: $id) {
                    ... on Order { id }
                    ... on ErrorResult { errorCode message }
                }
            }
        `, { id: lineId })) as any;
        expect(rm.removeOrderLine.id).toBeDefined();

        await shopClient.asUserWithCredentials(emailB, 'test');
        const res = (await shopClient.query(ADD_ITEM, { variantId, in: CHECK_IN, out: CHECK_OUT })) as any;
        expect(res.addItemToOrder.id).toBeDefined();
    }, 60000);

    it('⑤ admin 房量管理：批量设置 + 单日关房 → hotelRoomDays 可查', async () => {
        // 批量建 2026-12-07..09 各 5 间（含尾日），再把 12-08 关房
        const batch = (await adminClient.query(gql`
            mutation {
                batchSetHotelRoomDays(variantId: "${variantId}", from: "2026-12-07", to: "2026-12-09", totalRooms: 5)
            }
        `)) as any;
        expect(batch.batchSetHotelRoomDays).toBe(3);
        const set = (await adminClient.query(gql`
            mutation {
                setHotelRoomDay(variantId: "${variantId}", date: "2026-12-08", closed: true) {
                    id date totalRooms closed
                }
            }
        `)) as any;
        expect(set.setHotelRoomDay.closed).toBe(true);
        expect(set.setHotelRoomDay.totalRooms).toBe(5);

        const days = (await adminClient.query(gql`
            query { hotelRoomDays(variantId: "${variantId}", month: "2026-12") { date totalRooms closed } }
        `)) as any;
        const byDate = new Map(days.hotelRoomDays.map((d: any) => [d.date, d]));
        expect(byDate.get('2026-12-07')?.totalRooms).toBe(5);
        expect(byDate.get('2026-12-08')?.closed).toBe(true);
        // 早前由防超订 upsert 的缺省行也在
        expect(byDate.get('2026-12-01')?.totalRooms).toBe(1);

        // admin 端 hotelAvailability（房量日历「剩 N」数据源）
        const adminAvail = (await adminClient.query(gql`
            query { hotelAvailability(variantId: "${variantId}", from: "2026-12-07", to: "2026-12-09") { date priceCent remaining closed } }
        `)) as any;
        expect(adminAvail.hotelAvailability).toHaveLength(3);
        const adminByDate = new Map<string, any>(adminAvail.hotelAvailability.map((d: any) => [d.date, d]));
        expect(adminByDate.get('2026-12-07').remaining).toBe(5);
        expect(adminByDate.get('2026-12-07').priceCent).toBe(30000);
        expect(adminByDate.get('2026-12-08').closed).toBe(true);
        expect(adminByDate.get('2026-12-08').remaining).toBe(0);
    }, 60000);

    it('⑥ shop hotelAvailability：余量/关房/报价可见，关房晚加购被拦截', async () => {
        await shopClient.asAnonymousUser();
        const res = (await shopClient.query(gql`
            query {
                hotelAvailability(variantId: "${variantId}", from: "2026-12-07", to: "2026-12-09") {
                    date priceCent dayType remaining closed
                }
            }
        `)) as any;
        expect(res.hotelAvailability).toHaveLength(3); // 含两端
        const byDate = new Map<string, any>(res.hotelAvailability.map((d: any) => [d.date, d]));
        expect(byDate.get('2026-12-07').remaining).toBe(5);
        expect(byDate.get('2026-12-07').priceCent).toBe(30000);
        expect(byDate.get('2026-12-08').closed).toBe(true);
        expect(byDate.get('2026-12-08').remaining).toBe(0);

        // 关房晚在段内 → 加购拦截
        const item = (await shopClient.query(ADD_ITEM, { variantId, in: '2026-12-07', out: '2026-12-09' })) as any;
        expect(item.addItemToOrder.__typename).toBe('OrderInterceptorError');
        expect(item.addItemToOrder.interceptorError).toContain('HOTEL_SOLD_OUT');
        expect(item.addItemToOrder.interceptorError).toContain('2026-12-08');
    }, 60000);
});
