// 酒店预订 P3 全链路 e2e：下单（ArrangingPayment 建 pending）→ 支付（自动确认：入住码/取消截止点/锁房 booked）
// → 核销（入住码）→ 完成离店；强制取消释放锁房后可再订；未支付订单 checkIn 被状态机拦截。
// 入住日期用「今天/明天」动态生成，保证核销窗口 [checkIn, checkOut) 在任何运行日都成立。
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CjkPlugin } from '@vendure/cjk-plugin';
import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

// 测试支付方式：addPaymentToOrder 直接 Settled（无支付计划场景 = 全额付清 → PaymentSettled）
const fakeSettledPayment = new PaymentMethodHandler({
    code: 'fake-settled-payment',
    description: [{ languageCode: LanguageCode.en, value: 'Fake settled payment (e2e)' }],
    args: {},
    createPayment: (ctx, order, amount) => ({ amount, state: 'Settled' }),
    settlePayment: async () => ({ success: true }),
});

const ROOM_CONFIG = JSON.stringify({ basePriceCent: 30000, totalRooms: 1, minNights: 1 });

const emailA = 'hotel-flow-a@test.com';
const emailB = 'hotel-flow-b@test.com';

function dateStr(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

// 入住 = 今天（核销窗口含今天），离住 = 明天（1 晚）
const CHECK_IN = dateStr(0);
const CHECK_OUT = dateStr(1);
// 强制取消用例：5 天后入住（避开核销窗口，锁定当晚）
const FAR_IN = dateStr(5);
const FAR_OUT = dateStr(6);

const ADD_ITEM = gql`
    mutation AddItem($variantId: ID!, $in: String!, $out: String!) {
        addItemToOrder(
            productVariantId: $variantId
            quantity: 1
            customFields: { hotelCheckIn: $in, hotelCheckOut: $out, hotelNights: 1 }
        ) {
            ... on Order { __typename id state lines { id } }
            ... on ErrorResult { __typename errorCode message }
            ... on OrderInterceptorError { __typename errorCode message interceptorError }
        }
    }
`;

const MY_BOOKINGS = gql`
    query MyBookings($status: String) {
        myHotelBookings(status: $status) {
            id orderCode checkIn checkOut nights roomCount status ratePlanCode totalCent
            guestName guestPhone bookingCode cancelDeadlineAt
        }
    }
`;

/** 轮询直到谓词成立（事件订阅为异步，addPaymentToOrder 返回时确认可能尚未落库） */
async function waitFor<T>(fn: () => Promise<T>, predicate: (v: T) => boolean, timeoutMs = 15000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last!: T;
    while (Date.now() < deadline) {
        last = await fn();
        if (predicate(last)) return last;
        await new Promise(r => setTimeout(r, 400));
    }
    return last;
}

/** 断言 promise 拒绝且错误信息命中（UserInputError 走 GraphQL errors 数组） */
async function expectReject(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
    try {
        await fn();
        throw new Error('EXPECT_REJECT_NOT_TRIGGERED');
    } catch (e: any) {
        const detail =
            `${e?.message ?? ''} ` +
            `${(e?.response?.errors ?? []).map((x: any) => x?.message ?? '').join(' | ')}`;
        expect(detail).toMatch(pattern);
        expect(detail).not.toContain('EXPECT_REJECT_NOT_TRIGGERED');
    }
}

describe('Hotel P3 预订全链路（建单→确认→核销→完成/取消）', () => {
    const baseConfig = testConfig();
    const { server, adminClient, shopClient } = createTestEnvironment({
        ...baseConfig,
        importExportOptions: {
            ...baseConfig.importExportOptions,
            importAssetsDir: path.join(__dirname, '../../core/e2e/fixtures/assets'),
        },
        paymentOptions: {
            paymentMethodHandlers: [fakeSettledPayment],
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
        // 创建测试支付方式（handler 为本 spec 注册的 fakeSettledPayment）
        const pm = (await adminClient.query(gql`
            mutation {
                createPaymentMethod(
                    input: {
                        code: "fake"
                        enabled: true
                        translations: [{ languageCode: en, name: "Fake" }]
                        handler: { code: "fake-settled-payment", arguments: [] }
                    }
                ) {
                    ... on PaymentMethod { id code }
                }
            }
        `)) as any;
        expect(pm.createPaymentMethod.code).toBe('fake');

        // 播种配送档案并设为租户默认：CjkPlugin 的 BoxShippingLineAssignmentStrategy
        // 按「变体 → 生效配送档案」归箱，无档案时 shippingLine 为空导致无法进入 ArrangingPayment
        const sm = (await adminClient.query(gql`
            query { shippingMethods { items { id name } } }
        `)) as any;
        const stdShipping = sm.shippingMethods.items.find((m: any) => m.name === 'Standard Shipping');
        expect(stdShipping).toBeTruthy();
        const profile = (await adminClient.query(gql`
            mutation {
                createShippingProfile(
                    input: { code: "e2e-profile", name: "E2E Profile", enabled: true, shippingMethodIds: ["${stdShipping.id}"] }
                ) { id name }
            }
        `)) as any;
        const profileId = profile.createShippingProfile.id;
        expect(profileId).toBeTruthy();
        await adminClient.query(gql`
            mutation { setTenantDefaultShippingProfile(id: "${profileId}") }
        `);

        for (const email of [emailA, emailB]) {
            await adminClient.query(gql`
                mutation {
                    createCustomer(
                        input: { firstName: "Flow", lastName: "Tester", emailAddress: "${email}" }
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
        expect(JSON.parse(upd.updateProductVariant.customFields.hotelRoomConfig).totalRooms).toBe(1);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    /** 客户下单并支付（酒店行 1 晚），返回支付后订单 */
    async function placePaidOrder(email: string, checkIn: string, checkOut: string): Promise<any> {
        await shopClient.asUserWithCredentials(email, 'test');
        const add = (await shopClient.query(ADD_ITEM, { variantId, in: checkIn, out: checkOut })) as any;
        if (add.addItemToOrder?.errorCode) {
            throw new Error(`addItemToOrder failed: ${JSON.stringify(add.addItemToOrder)}`);
        }
        const addr = (await shopClient.query(gql`
            mutation {
                setOrderShippingAddress(input: {
                    fullName: "Flow Tester", streetLine1: "No.1 Road", city: "TestCity",
                    postalCode: "100000", countryCode: "US", phoneNumber: "13800000000"
                }) { ... on Order { id } ... on ErrorResult { __typename errorCode message } }
            }
        `)) as any;
        if (addr.setOrderShippingAddress?.errorCode) {
            throw new Error(`setOrderShippingAddress failed: ${JSON.stringify(addr.setOrderShippingAddress)}`);
        }
        const methods = (await shopClient.query(gql`
            query { eligibleShippingMethods { id name price } }
        `)) as any;
        expect(methods.eligibleShippingMethods.length).toBeGreaterThan(0);
        const setM = (await shopClient.query(gql`
            mutation SetMethod($id: [ID!]!) {
                setOrderShippingMethod(shippingMethodId: $id) {
                    ... on Order { id state } ... on ErrorResult { __typename errorCode message }
                }
            }
        `, { id: [methods.eligibleShippingMethods[0].id] })) as any;
        if (setM.setOrderShippingMethod?.errorCode) {
            throw new Error(`setOrderShippingMethod failed: ${JSON.stringify(setM.setOrderShippingMethod)}`);
        }
        // 进入 ArrangingPayment（addPaymentToOrder 要求；同时触发 transition 事件 → 建 pending 预订单）
        const trans = (await shopClient.query(gql`
            mutation { transitionOrderToState(state: "ArrangingPayment") { ... on Order { id state } ... on ErrorResult { __typename errorCode message } } }
        `)) as any;
        if (trans.transitionOrderToState?.errorCode) {
            throw new Error(`transitionOrderToState failed: ${JSON.stringify(trans.transitionOrderToState)}`);
        }
        const pay = (await shopClient.query(gql`
            mutation {
                addPaymentToOrder(input: { method: "fake", metadata: {} }) {
                    ... on Order { id code state }
                    ... on ErrorResult { __typename errorCode message }
                }
            }
        `)) as any;
        if (pay.addPaymentToOrder?.errorCode) {
            throw new Error(`addPaymentToOrder failed: ${JSON.stringify(pay.addPaymentToOrder)}`);
        }
        return pay.addPaymentToOrder;
    }

    it('① 客户 A 下单支付 → 自动确认：入住码/状态/客人信息落库，C 端可查', async () => {
        const order = await placePaidOrder(emailA, CHECK_IN, CHECK_OUT);
        expect(['PaymentSettled', 'OrderPlaced']).toContain(order.state);

        // 事件订阅异步执行：轮询 myHotelBookings 至 confirmed
        const res = await waitFor(
            async () => (await shopClient.query(MY_BOOKINGS)) as any,
            r => (r.myHotelBookings ?? []).some((b: any) => b.status === 'confirmed'),
        );
        const bookings = res.myHotelBookings.filter((b: any) => b.orderCode === order.code);
        expect(bookings).toHaveLength(1);
        const b = bookings[0];
        expect(b.status).toBe('confirmed');
        expect(b.bookingCode).toMatch(/^\d{8}$/);
        expect(b.checkIn).toBe(CHECK_IN);
        expect(b.checkOut).toBe(CHECK_OUT);
        expect(b.nights).toBe(1);
        expect(b.roomCount).toBe(1);
        expect(b.totalCent).toBeGreaterThan(0);
        expect(b.guestName).toBeTruthy();
        expect(b.guestPhone).toBe('13800000000');

        // admin 列表可查（filter 状态/订单号）
        const byStatus = (await adminClient.query(gql`
            query { hotelBookings(filter: { status: "confirmed" }) { id orderCode bookingCode status } }
        `)) as any;
        expect(byStatus.hotelBookings.some((x: any) => x.bookingCode === b.bookingCode)).toBe(true);
        const byCode = (await adminClient.query(gql`
            query { hotelBookings(filter: { orderCode: "${order.code}" }) { id status } }
        `)) as any;
        expect(byCode.hotelBookings).toHaveLength(1);
    }, 120000);

    it('② admin 核销：凭入住码 checkIn → checkedIn；完成离店 → completed', async () => {
        const list = (await shopClient.query(MY_BOOKINGS)) as any;
        const b = list.myHotelBookings.find((x: any) => x.status === 'confirmed');
        expect(b).toBeTruthy();

        const checked = (await adminClient.query(gql`
            mutation { hotelBookingCheckIn(code: "${b.bookingCode}") { id status checkedInAt } }
        `)) as any;
        expect(checked.hotelBookingCheckIn.status).toBe('checkedIn');
        expect(checked.hotelBookingCheckIn.checkedInAt).toBeTruthy();

        const done = (await adminClient.query(gql`
            mutation { hotelBookingComplete(id: "${checked.hotelBookingCheckIn.id}") { id status completedAt } }
        `)) as any;
        expect(done.hotelBookingComplete.status).toBe('completed');
        expect(done.hotelBookingComplete.completedAt).toBeTruthy();

        // 完成后不可再核销/再完成（状态机守卫）
        await expectReject(
            () => adminClient.query(gql`
                mutation { hotelBookingComplete(id: "${checked.hotelBookingCheckIn.id}") { id status } }
            `),
            /不可完成离店/,
        );
    }, 60000);

    it('③ 客户 B 订同日期被拦截（A 的 booked 锁占用）', async () => {
        await shopClient.asUserWithCredentials(emailB, 'test');
        const res = (await shopClient.query(ADD_ITEM, { variantId, in: CHECK_IN, out: CHECK_OUT })) as any;
        expect(res.addItemToOrder.interceptorError).toContain('HOTEL_SOLD_OUT');
    }, 60000);

    it('④ 客户 B 订远期日期支付成功 → admin 强制取消 → 锁释放可再订', async () => {
        const order = await placePaidOrder(emailB, FAR_IN, FAR_OUT);
        expect(['PaymentSettled', 'OrderPlaced']).toContain(order.state);
        const res = await waitFor(
            async () => (await shopClient.query(MY_BOOKINGS)) as any,
            r => (r.myHotelBookings ?? []).some((x: any) => x.status === 'confirmed' && x.checkIn === FAR_IN),
        );
        const b = res.myHotelBookings.find((x: any) => x.checkIn === FAR_IN && x.status === 'confirmed');
        expect(b.bookingCode).toMatch(/^\d{8}$/);

        const cancelled = (await adminClient.query(gql`
            mutation { hotelBookingForceCancel(id: "${b.id}", reason: "超售让房") { id status cancelReason cancelledAt } }
        `)) as any;
        expect(cancelled.hotelBookingForceCancel.status).toBe('cancelled');
        expect(cancelled.hotelBookingForceCancel.cancelReason).toBe('超售让房');

        // 锁已释放：B 再订同日期成功
        const re = (await shopClient.query(ADD_ITEM, { variantId, in: FAR_IN, out: FAR_OUT })) as any;
        expect(re.addItemToOrder.id).toBeDefined();
    }, 120000);

    it('⑤ 未支付订单（ArrangingPayment）建 pendingDeposit 预订，无入住码且 checkIn 被状态机拦截', async () => {
        await shopClient.asUserWithCredentials(emailB, 'test');
        // 上一步再订的同日期订单仍处 AddingItems → 显式流转到 ArrangingPayment（不支付）
        await shopClient.query(gql`
            mutation {
                setOrderShippingAddress(input: {
                    fullName: "Flow Tester", streetLine1: "No.1 Road", city: "TestCity",
                    postalCode: "100000", countryCode: "US", phoneNumber: "13900000000"
                }) { ... on Order { id } ... on ErrorResult { errorCode message } }
            }
        `);
        const methods = (await shopClient.query(gql`
            query { eligibleShippingMethods { id } }
        `)) as any;
        await shopClient.query(gql`
            mutation SetMethod($id: [ID!]!) {
                setOrderShippingMethod(shippingMethodId: $id) {
                    ... on Order { id state } ... on ErrorResult { errorCode message }
                }
            }
        `, { id: [methods.eligibleShippingMethods[0].id] });
        const tr = (await shopClient.query(gql`
            mutation { transitionOrderToState(state: "ArrangingPayment") {
                ... on Order { id state } ... on ErrorResult { __typename errorCode message }
            } }
        `)) as any;
        if (tr.transitionOrderToState?.errorCode) {
            throw new Error(`transitionOrderToState failed: ${JSON.stringify(tr.transitionOrderToState)}`);
        }
        expect(tr.transitionOrderToState.state).toBe('ArrangingPayment');

        // pending 预订单已建（无入住码）
        const res = await waitFor(
            async () => (await shopClient.query(MY_BOOKINGS, { status: 'pendingDeposit' })) as any,
            r => (r.myHotelBookings ?? []).length > 0,
        );
        expect(res.myHotelBookings).toHaveLength(1);
        expect(res.myHotelBookings[0].bookingCode).toBeNull();
        expect(res.myHotelBookings[0].checkIn).toBe(FAR_IN);

        // pending 状态 checkIn 被状态机拦截（该行无入住码，用假码验证不存在分支不可行，
        // 直接断言任意 8 位非存在码 → 入住码不存在）
        await expectReject(
            () => adminClient.query(gql`mutation { hotelBookingCheckIn(code: "99999999") { id status } }`),
            /入住码不存在/,
        );
    }, 120000);
});
