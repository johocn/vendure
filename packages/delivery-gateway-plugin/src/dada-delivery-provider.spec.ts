import { describe, it, expect } from 'vitest';
import { DadaDeliveryProvider } from './dada-delivery-provider';
import { DadaHttpAdapter } from './dada-http.adapter';

const makeProvider = (http?: DadaHttpAdapter) =>
    new DadaDeliveryProvider(
        { appKey: 'k', appSecret: 's', shopNo: '1', environment: 'sandbox', callbackUrl: 'http://x/cb' },
        http,
    );

/** 构造达达回调报文：业务字段在 body(JSON 字符串) 内 */
const cb = (business: Record<string, unknown>) => ({ body: JSON.stringify(business) });

describe('DadaDeliveryProvider.parseWebhook 状态码映射全表', () => {
    const cases: Array<[number, string]> = [
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
        it(`达达 ${code} -> ${expected}`, () => {
            const ev = makeProvider().parseWebhook(cb({ order_id: 'TDD1', order_status: code }));
            expect(ev.status).toBe(expected);
            expect(ev.deliveryOrderNo).toBe('TDD1');
        });
    }

    it('order_id 缺失时兜底 client_id（定位键=thirdPartyNo）', () => {
        const ev = makeProvider().parseWebhook(cb({ client_id: 'DADA123', order_status: 5 }));
        expect(ev.deliveryOrderNo).toBe('DADA123');
        expect(ev.status).toBe('delivered');
        expect(ev.deliveredAt).toBeInstanceOf(Date);
    });

    it('兼容平铺 top-level 业务字段（无 body）', () => {
        const ev = makeProvider().parseWebhook({ order_id: 'X1', order_status: 2 });
        expect(ev.status).toBe('accepted');
    });

    it('未知状态码抛错', () => {
        expect(() => makeProvider().parseWebhook(cb({ order_id: 'x', order_status: 99 }))).toThrow(/未识别/);
    });

    it('order_id/client_id 均缺失抛错', () => {
        expect(() => makeProvider().parseWebhook(cb({ order_status: 2 }))).toThrow(/order_id/);
    });

    it('映射骑手与原因字段', () => {
        const ev = makeProvider().parseWebhook(
            cb({ order_id: 'x', order_status: 10, transporter_name: '骑手A', transporter_phone: '138', cancel_reason: '客户取消' }),
        );
        expect(ev.courierName).toBe('骑手A');
        expect(ev.courierPhone).toBe('138');
        expect(ev.reason).toBe('客户取消');
    });
});

describe('DadaDeliveryProvider.createDelivery 契约（fake 适配器）', () => {
    it('origin_id=本地单号→deliveryOrderNo，deliveryNo→thirdPartyNo，fee 透传', async () => {
        const posts: Array<{ path: string; params: Record<string, unknown> }> = [];
        const fake: DadaHttpAdapter = {
            async post(path, params) {
                posts.push({ path, params });
                return { status: 'success', result: { deliveryNo: 'DADA-888', fee: 1200 } };
            },
        };
        const res = await makeProvider(fake).createDelivery({} as any, {
            orderId: '1',
            packageId: 'PKG-1',
            pickup: { name: 'A', lat: 1, lng: 2 },
            dropoff: { name: 'B', address: 'addr', lat: 3, lng: 4, phone: '138' },
            items: [{ name: '水', quantity: 2 }],
            deliveryType: 'instant',
        } as any);
        expect(res.deliveryOrderNo).toMatch(/^TDD\d+$/);
        expect(res.thirdPartyNo).toBe('DADA-888');
        expect(res.status).toBe('pending');
        expect(res.fee).toBe(1200);
        expect(posts.length).toBe(1);
        expect(posts[0].path).toBe('/api/order/addOrder');
        const body = JSON.parse(String((posts[0].params as any).body));
        expect(body.origin_id).toBe(res.deliveryOrderNo);
        expect(body.shop_no).toBe('1');
        expect(body.callback).toBe('http://x/cb');
        expect(body.receiver_name).toBe('B');
        expect((posts[0].params as any).signature).toMatch(/^[0-9A-F]{32}$/);
    });

    it('返回非 success 抛错', async () => {
        const fake: DadaHttpAdapter = {
            async post() {
                return { status: 'fail', errorCode: 123, msg: 'no quota' };
            },
        };
        await expect(makeProvider(fake).createDelivery({} as any, {
            orderId: '1',
            packageId: 'P',
            pickup: { name: 'A', lat: 1, lng: 2 },
            dropoff: { name: 'B', lat: 3, lng: 4 },
            items: [{ name: '水', quantity: 1 }],
            deliveryType: 'instant',
        } as any)).rejects.toThrow(/达达下单失败/);
    });

    it('quote 出站失败返回 available:false 不抛错', async () => {
        const fake: DadaHttpAdapter = {
            async post() {
                throw new Error('network down');
            },
        };
        const q = await makeProvider(fake).quote({} as any, {
            pickup: { name: 'A', lat: 1, lng: 2 },
            dropoff: { name: 'B', lat: 3, lng: 4 },
            items: [{ name: '水', quantity: 1 }],
            deliveryType: 'instant',
        } as any);
        expect(q.available).toBe(false);
    });
});
