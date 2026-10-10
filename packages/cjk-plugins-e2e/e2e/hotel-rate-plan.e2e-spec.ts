// 酒店预订 P2 e2e 探针：房价方案 CRUD + 会员/非会员可见性 + 下单带 ratePlanCode 计价
// 口径：discount 千分比/surcharge 分叠加连住优惠；fixed 固定价不叠加；坏 code/停用/不可售/会员不达标 → 回退基价
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CjkPlugin } from '@vendure/cjk-plugin';
import { MemberLevelPlugin } from '@vendure/member-level-plugin';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

const ROOM_CONFIG = JSON.stringify({
    basePriceCent: 30000,
    totalRooms: 5,
    minNights: 1,
    longStayDiscount: [{ minNights: 3, rate: 0.9 }],
});

const LV3_EMAIL = 'rateplan-lv3@test.com';
const LV1_EMAIL = 'rateplan-lv1@test.com';

const CHECK_IN = '2026-12-01';

const CREATE_PLAN = gql`
    mutation CreatePlan($variantId: ID!, $input: HotelRatePlanInput!) {
        createHotelRatePlan(variantId: $variantId, input: $input) {
            id code name adjustType adjustValue memberOnly dateFrom dateTo enabled
        }
    }
`;

const PLANS_ADMIN = gql`
    query PlansAdmin($variantId: ID!) {
        hotelRatePlans(variantId: $variantId) { id code adjustType adjustValue memberOnly enabled }
    }
`;

const PLANS_SHOP = gql`
    query PlansShop($variantId: ID!, $checkIn: String) {
        hotelRatePlans(variantId: $variantId, checkIn: $checkIn) {
            code name adjustType adjustValue memberOnly avgNightlyEstimateCent
        }
    }
`;

const ADD_ITEM = gql`
    mutation AddItem($variantId: ID!, $in: String!, $out: String!, $nights: Int!, $planCode: String) {
        addItemToOrder(
            productVariantId: $variantId
            quantity: $nights
            customFields: { hotelCheckIn: $in, hotelCheckOut: $out, hotelNights: $nights, ratePlanCode: $planCode }
        ) {
            ... on Order { id lines { id quantity linePriceWithTax unitPriceWithTax customFields { hotelCheckIn ratePlanCode } } }
            ... on ErrorResult { __typename errorCode message }
            ... on OrderInterceptorError { __typename errorCode message interceptorError }
        }
    }
`;

const ACTIVE_ORDER = gql`
    query {
        activeOrder {
            id
            lines { id quantity linePriceWithTax unitPriceWithTax customFields { hotelCheckIn ratePlanCode } }
        }
    }
`;

describe('Hotel P2 房价方案（admin CRUD + shop 可见性 + 下单计价）', () => {
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
            MemberLevelPlugin.init({}),
        ],
    });

    let variantId: string;
    let discPlanId: string;
    let protocolPlanId: string;

    beforeAll(async () => {
        await server.init({
            initialData: { ...initialData, paymentMethods: [] },
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        // 顾客：LV3（memberLevel=3）与 LV1（默认 1）
        for (const [email, level] of [[LV3_EMAIL, 3], [LV1_EMAIL, 1]] as const) {
            const created = (await adminClient.query(gql`
                mutation {
                    createCustomer(
                        input: { firstName: "Rate", lastName: "Plan", emailAddress: "${email}" }
                        password: "test"
                    ) {
                        ... on Customer { id emailAddress }
                        ... on ErrorResult { errorCode message }
                    }
                }
            `)) as any;
            expect(created.createCustomer.id).toBeDefined();
            if (level > 1) {
                const upd = (await adminClient.query(gql`
                    mutation {
                        updateCustomer(input: { id: "${created.createCustomer.id}", customFields: { memberLevel: ${level} } }) {
                            ... on Customer { id customFields { memberLevel } }
                            ... on ErrorResult { errorCode message }
                        }
                    }
                `)) as any;
                expect(upd.updateCustomer.customFields.memberLevel).toBe(level);
            }
        }

        // 房型：基准 300/晚，连住 3 晚 0.9
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
        expect(JSON.parse(upd.updateProductVariant.customFields.hotelRoomConfig).basePriceCent).toBe(30000);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('① admin CRUD：三种 adjustType + memberOnly + 售卖期；重复 code / 非法值被拒', async () => {
        const disc = (await adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'DISC900', name: '早鸟9折', adjustType: 'discount', adjustValue: 900, enabled: true },
        })) as any;
        expect(disc.createHotelRatePlan.code).toBe('DISC900');
        discPlanId = disc.createHotelRatePlan.id;

        const protocol = (await adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'PROTOCOL', name: '协议价', adjustType: 'fixed', adjustValue: 20000, enabled: true },
        })) as any;
        expect(protocol.createHotelRatePlan.adjustValue).toBe(20000);
        protocolPlanId = protocol.createHotelRatePlan.id;

        const vip = (await adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'VIP3', name: '银卡专属', adjustType: 'discount', adjustValue: 800, memberOnly: '3', enabled: true },
        })) as any;
        expect(vip.createHotelRatePlan.memberOnly).toBe('3');

        // 售卖期方案：入住日在窗口内可售
        const windowed = (await adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'WINDOW', name: '限时特惠', adjustType: 'surcharge', adjustValue: 3000, dateFrom: '2026-12-01', dateTo: '2026-12-31', enabled: true },
        })) as any;
        expect(windowed.createHotelRatePlan.dateFrom).toBe('2026-12-01');

        // 窗口外方案：入住日不可售（fail-closed）
        const outwin = (await adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'OUTWIN', name: '未来价', adjustType: 'discount', adjustValue: 500, dateFrom: '2027-06-01', enabled: true },
        })) as any;
        expect(outwin.createHotelRatePlan.id).toBeDefined();

        // 重复 code 拒绝（服务层抛错 → GraphQL errors）
        await expect(adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'DISC900', name: '重复', adjustType: 'fixed', adjustValue: 100 },
        })).rejects.toThrow('方案码已存在');

        // discount=0 拒绝
        await expect(adminClient.query(CREATE_PLAN, {
            variantId,
            input: { code: 'BAD', name: '非法', adjustType: 'discount', adjustValue: 0 },
        })).rejects.toThrow('千分比');

        const list = (await adminClient.query(PLANS_ADMIN, { variantId })) as any;
        expect(list.hotelRatePlans.length).toBe(5);
    }, 60000);

    it('② shop 未登录：仅可见非 memberOnly 且售卖期覆盖默认窗口的方案 + 日均价预估', async () => {
        await shopClient.asAnonymousUser();
        const res = (await shopClient.query(PLANS_SHOP, { variantId, checkIn: CHECK_IN })) as any;
        const codes = res.hotelRatePlans.map((p: any) => p.code).sort();
        // 匿名：VIP3（memberOnly）与 OUTWIN（售卖期不含入住日）不可见
        expect(codes).toEqual(['DISC900', 'PROTOCOL', 'WINDOW']);
        expect(codes).not.toContain('VIP3');
        expect(codes).not.toContain('OUTWIN');
        const disc = res.hotelRatePlans.find((p: any) => p.code === 'DISC900');
        expect(disc.avgNightlyEstimateCent).toBe(27000); // 30000 × 0.9
        const protocol = res.hotelRatePlans.find((p: any) => p.code === 'PROTOCOL');
        expect(protocol.avgNightlyEstimateCent).toBe(20000);
        const windowed = res.hotelRatePlans.find((p: any) => p.code === 'WINDOW');
        expect(windowed.avgNightlyEstimateCent).toBe(33000); // 30000 + 3000
    }, 60000);

    it('③ shop LV3 会员：可见 VIP3；LV1 不可见', async () => {
        await shopClient.asUserWithCredentials(LV3_EMAIL, 'test');
        const lv3 = (await shopClient.query(PLANS_SHOP, { variantId, checkIn: CHECK_IN })) as any;
        expect(lv3.hotelRatePlans.map((p: any) => p.code)).toContain('VIP3');

        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const lv1 = (await shopClient.query(PLANS_SHOP, { variantId, checkIn: CHECK_IN })) as any;
        expect(lv1.hotelRatePlans.map((p: any) => p.code)).not.toContain('VIP3');
    }, 60000);

    it('④ 下单带 ratePlanCode=DISC900：1 晚 27000（连住优惠不参与单晚）', async () => {
        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const res = (await shopClient.query(ADD_ITEM, {
            variantId, in: CHECK_IN, out: '2026-12-02', nights: 1, planCode: 'DISC900',
        })) as any;
        expect(res.addItemToOrder.id).toBeDefined();
        const line = res.addItemToOrder.lines.find((l: any) => l.customFields.ratePlanCode === 'DISC900');
        expect(line.unitPriceWithTax).toBe(27000);
        expect(line.linePriceWithTax).toBe(27000);
    }, 60000);

    it('⑤ fixed 方案 3 晚：每晚 20000，连住优惠不再叠加（总价 60000 而非 ×0.9）', async () => {
        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const res = (await shopClient.query(ADD_ITEM, {
            variantId, in: '2026-12-05', out: '2026-12-08', nights: 3, planCode: 'PROTOCOL',
        })) as any;
        expect(res.addItemToOrder.id).toBeDefined();
        const line = res.addItemToOrder.lines.find((l: any) => l.customFields.ratePlanCode === 'PROTOCOL');
        expect(line.quantity).toBe(3);
        expect(line.unitPriceWithTax).toBe(20000);
        expect(line.linePriceWithTax).toBe(60000);
    }, 60000);

    it('⑥ 坏 code（NOPE）回退基价 30000', async () => {
        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const res = (await shopClient.query(ADD_ITEM, {
            variantId, in: '2026-12-10', out: '2026-12-11', nights: 1, planCode: 'NOPE',
        })) as any;
        expect(res.addItemToOrder.id).toBeDefined();
        const line = res.addItemToOrder.lines.find((l: any) => l.customFields.ratePlanCode === 'NOPE');
        expect(line.unitPriceWithTax).toBe(30000);
    }, 60000);

    it('⑦ memberOnly 方案：LV3 下单按 800 折计价（24000/晚）；LV1 带同 code 回退基价', async () => {
        // LV3：3 晚 VIP3 → 30000×0.8=24000/晚，总价 72000（连住 0.9 → 64800，均 21600）
        await shopClient.asUserWithCredentials(LV3_EMAIL, 'test');
        const lv3 = (await shopClient.query(ADD_ITEM, {
            variantId, in: '2026-12-15', out: '2026-12-18', nights: 3, planCode: 'VIP3',
        })) as any;
        expect(lv3.addItemToOrder.id).toBeDefined();
        const lv3Line = lv3.addItemToOrder.lines.find((l: any) => l.customFields.ratePlanCode === 'VIP3');
        expect(lv3Line.linePriceWithTax).toBe(Math.round(3 * 24000 * 0.9)); // 64800

        // LV1：同 code → 不可用 → 基价（3 晚含连住 0.9：30000×3×0.9=81000，均 27000）
        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const lv1 = (await shopClient.query(ADD_ITEM, {
            variantId, in: '2026-12-20', out: '2026-12-23', nights: 3, planCode: 'VIP3',
        })) as any;
        expect(lv1.addItemToOrder.id).toBeDefined();
        const lv1Line = lv1.addItemToOrder.lines.find((l: any) => l.customFields.ratePlanCode === 'VIP3');
        expect(lv1Line.unitPriceWithTax).toBe(27000);
        expect(lv1Line.linePriceWithTax).toBe(81000);
    }, 60000);

    it('⑧ 停用方案后下单回退基价；delete 生效', async () => {
        const upd = (await adminClient.query(gql`
            mutation {
                updateHotelRatePlan(id: "${discPlanId}", input: { enabled: false }) {
                    id code enabled
                }
            }
        `)) as any;
        expect(upd.updateHotelRatePlan.enabled).toBe(false);

        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const res = (await shopClient.query(ADD_ITEM, {
            variantId, in: '2026-12-25', out: '2026-12-26', nights: 1, planCode: 'DISC900',
        })) as any;
        // 按 code + 入住日定位新行（订单里已有④的 DISC900 旧行，其价格不回刷）
        const line = res.addItemToOrder.lines.find(
            (l: any) => l.customFields.ratePlanCode === 'DISC900' && l.customFields.hotelCheckIn === '2026-12-25',
        );
        expect(line.unitPriceWithTax).toBe(30000); // 停用 → 基价

        const del = (await adminClient.query(gql`
            mutation { deleteHotelRatePlan(id: "${discPlanId}") }
        `)) as any;
        expect(del.deleteHotelRatePlan).toBe(true);
        const list = (await adminClient.query(PLANS_ADMIN, { variantId })) as any;
        expect(list.hotelRatePlans.map((p: any) => p.code)).not.toContain('DISC900');
    }, 60000);

    it('⑨ activeOrder 行上 ratePlanCode 可查（C 端回显）', async () => {
        await shopClient.asUserWithCredentials(LV1_EMAIL, 'test');
        const res = (await shopClient.query(ACTIVE_ORDER)) as any;
        const codes = res.activeOrder.lines.map((l: any) => l.customFields.ratePlanCode);
        expect(codes).toContain('PROTOCOL');
        expect(codes).toContain('NOPE');
    }, 60000);
});
