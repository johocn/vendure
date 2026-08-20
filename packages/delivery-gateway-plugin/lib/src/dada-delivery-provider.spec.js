"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dada_delivery_provider_1 = require("./dada-delivery-provider");
const makeProvider = (http) => new dada_delivery_provider_1.DadaDeliveryProvider({ appKey: 'k', appSecret: 's', shopNo: '1', environment: 'sandbox', callbackUrl: 'http://x/cb' }, http);
/** 构造达达回调报文：业务字段在 body(JSON 字符串) 内 */
const cb = (business) => ({ body: JSON.stringify(business) });
(0, vitest_1.describe)('DadaDeliveryProvider.parseWebhook 状态码映射全表', () => {
    const cases = [
        [1, 'pending'],
        [2, 'accepted'],
        [3, 'pickup'],
        [4, 'pickup'],
        [5, 'delivered'],
        [7, 'cancelled'],
        [10, 'cancelled'],
        [1000, 'exception'],
    ];
    for (const [code, expected] of cases) {
        (0, vitest_1.it)(`达达 ${code} -> ${expected}`, () => {
            const ev = makeProvider().parseWebhook(cb({ order_id: 'TDD1', order_status: code }));
            (0, vitest_1.expect)(ev.status).toBe(expected);
            (0, vitest_1.expect)(ev.deliveryOrderNo).toBe('TDD1');
        });
    }
    (0, vitest_1.it)('order_id 缺失时兜底 client_id（定位键=thirdPartyNo）', () => {
        const ev = makeProvider().parseWebhook(cb({ client_id: 'DADA123', order_status: 5 }));
        (0, vitest_1.expect)(ev.deliveryOrderNo).toBe('DADA123');
        (0, vitest_1.expect)(ev.status).toBe('delivered');
        (0, vitest_1.expect)(ev.deliveredAt).toBeInstanceOf(Date);
    });
    (0, vitest_1.it)('兼容平铺 top-level 业务字段（无 body）', () => {
        const ev = makeProvider().parseWebhook({ order_id: 'X1', order_status: 2 });
        (0, vitest_1.expect)(ev.status).toBe('accepted');
    });
    (0, vitest_1.it)('未知状态码抛错', () => {
        (0, vitest_1.expect)(() => makeProvider().parseWebhook(cb({ order_id: 'x', order_status: 99 }))).toThrow(/未识别/);
    });
    (0, vitest_1.it)('order_id/client_id 均缺失抛错', () => {
        (0, vitest_1.expect)(() => makeProvider().parseWebhook(cb({ order_status: 2 }))).toThrow(/order_id/);
    });
    (0, vitest_1.it)('映射骑手与原因字段', () => {
        const ev = makeProvider().parseWebhook(cb({ order_id: 'x', order_status: 10, transporter_name: '骑手A', transporter_phone: '138', cancel_reason: '客户取消' }));
        (0, vitest_1.expect)(ev.courierName).toBe('骑手A');
        (0, vitest_1.expect)(ev.courierPhone).toBe('138');
        (0, vitest_1.expect)(ev.reason).toBe('客户取消');
    });
});
(0, vitest_1.describe)('DadaDeliveryProvider.createDelivery 契约（fake 适配器）', () => {
    (0, vitest_1.it)('origin_id=本地单号→deliveryOrderNo，deliveryNo→thirdPartyNo，fee 透传', async () => {
        const posts = [];
        const fake = {
            async post(path, params) {
                posts.push({ path, params });
                return { status: 'success', result: { deliveryNo: 'DADA-888', fee: 1200 } };
            },
        };
        const res = await makeProvider(fake).createDelivery({}, {
            orderId: '1',
            packageId: 'PKG-1',
            pickup: { name: 'A', lat: 1, lng: 2 },
            dropoff: { name: 'B', address: 'addr', lat: 3, lng: 4, phone: '138' },
            items: [{ name: '水', quantity: 2 }],
            deliveryType: 'instant',
        });
        (0, vitest_1.expect)(res.deliveryOrderNo).toMatch(/^TDD\d+$/);
        (0, vitest_1.expect)(res.thirdPartyNo).toBe('DADA-888');
        (0, vitest_1.expect)(res.status).toBe('pending');
        (0, vitest_1.expect)(res.fee).toBe(1200);
        (0, vitest_1.expect)(posts.length).toBe(1);
        (0, vitest_1.expect)(posts[0].path).toBe('/api/order/addOrder');
        const body = JSON.parse(String(posts[0].params.body));
        (0, vitest_1.expect)(body.origin_id).toBe(res.deliveryOrderNo);
        (0, vitest_1.expect)(body.shop_no).toBe('1');
        (0, vitest_1.expect)(body.callback).toBe('http://x/cb');
        (0, vitest_1.expect)(body.receiver_name).toBe('B');
        (0, vitest_1.expect)(posts[0].params.signature).toMatch(/^[0-9A-F]{32}$/);
    });
    (0, vitest_1.it)('返回非 success 抛错', async () => {
        const fake = {
            async post() {
                return { status: 'fail', errorCode: 123, msg: 'no quota' };
            },
        };
        await (0, vitest_1.expect)(makeProvider(fake).createDelivery({}, {
            orderId: '1',
            packageId: 'P',
            pickup: { name: 'A', lat: 1, lng: 2 },
            dropoff: { name: 'B', lat: 3, lng: 4 },
            items: [{ name: '水', quantity: 1 }],
            deliveryType: 'instant',
        })).rejects.toThrow(/达达下单失败/);
    });
    (0, vitest_1.it)('quote 出站失败返回 available:false 不抛错', async () => {
        const fake = {
            async post() {
                throw new Error('network down');
            },
        };
        const q = await makeProvider(fake).quote({}, {
            pickup: { name: 'A', lat: 1, lng: 2 },
            dropoff: { name: 'B', lat: 3, lng: 4 },
            items: [{ name: '水', quantity: 1 }],
            deliveryType: 'instant',
        });
        (0, vitest_1.expect)(q.available).toBe(false);
    });
});
//# sourceMappingURL=dada-delivery-provider.spec.js.map