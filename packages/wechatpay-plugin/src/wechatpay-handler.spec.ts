import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import type { RequestContext } from '@vendure/core';

// 重依赖全部 mock：wechatpay-node-v3 不发真实请求；cjk payment-config 不读渠道配置；
// resolveCustomerOpenid 只记录调用参数（本次修复核心是 handler 传给它的 preferMini 语义），
// WechatpayService 保留真实导出供取舍逻辑测试
vi.mock('./wechatpay.service', async (importOriginal) => {
    const actual: any = await importOriginal();
    return { ...actual, resolveCustomerOpenid: vi.fn().mockResolvedValue('mock-openid') };
});
vi.mock('@vendure/cjk-plugin/lib/src/payment/payment-config', () => ({
    getPaymentOverride: vi.fn().mockReturnValue(null),
}));
const jsapiMock = vi.fn().mockResolvedValue({ data: { prepay_id: 'PREPAY1' } });
vi.mock('wechatpay-node-v3', () => ({
    default: vi.fn().mockImplementation(() => ({ transactions_jsapi: jsapiMock })),
}));

import { createWechatpayHandler } from './wechatpay-handler';
import { resolveCustomerOpenid } from './wechatpay.service';
import { WechatpayService } from './wechatpay.service';

const ctx = { req: { ip: '127.0.0.1' } } as unknown as RequestContext;
const order = { code: 'ORD1', customerId: 5 } as any;
// 测试专用一次性 RSA 私钥，仅供 JSAPI paySign 签名走通
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
// Vendure handler 包装层要求 args 为数组形式（name/value），内部再转 hash
const args = Object.entries({
    appId: 'wx-test-appid',
    mchId: '1900000000',
    publicKey: 'PUB',
    privateKey: pem,
    apiKey: 'k',
    serialNo: 's',
    tradeType: 'JSAPI',
}).map(([name, value]) => ({ name, value })) as any;

describe('createWechatpayHandler openid preferMini 语义（F-VS-08 修正）', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (resolveCustomerOpenid as ReturnType<typeof vi.fn>).mockResolvedValue('mock-openid');
    });

    it("默认 PM（code='wechatpay'）JSAPI → preferMini=true（小程序 appid 配小程序 openid）", async () => {
        const handler = createWechatpayHandler({} as any, 'wechatpay');
        await handler.createPayment!(ctx, order, 1000, args, {}, {} as any);
        expect(resolveCustomerOpenid).toHaveBeenCalledWith(ctx, 5, { preferMini: true });
    });

    it("公众号 JSAPI PM（code='wechatpay-yourbao-h5'）→ preferMini=false（公众号 openid 配公众号 appid）", async () => {
        const handler = createWechatpayHandler({} as any, 'wechatpay-yourbao-h5');
        await handler.createPayment!(ctx, order, 1000, args, {}, {} as any);
        expect(resolveCustomerOpenid).toHaveBeenCalledWith(ctx, 5, { preferMini: false });
    });

    it('前端显式传 metadata.openid 时不触发客户档案推导', async () => {
        const handler = createWechatpayHandler({} as any, 'wechatpay');
        await handler.createPayment!(ctx, order, 1000, args, { openid: 'front-openid' }, {} as any);
        expect(resolveCustomerOpenid).not.toHaveBeenCalled();
    });
});

describe('WechatpayService.resolveCustomerOpenid 取舍', () => {
    function makeService(customFields: Record<string, string | undefined>) {
        return new WechatpayService(
            {} as any,
            {} as any,
            {} as any,
            {
                getRepository: () => ({
                    findOne: vi.fn().mockResolvedValue({ customFields }),
                }),
            } as any,
            {} as any,
        );
    }

    it('双 openid：preferMini=true 取小程序，否则取公众号', async () => {
        const both = { wechatOpenid: 'o-official', wechatMiniOpenid: 'o-mini' };
        expect(await makeService(both).resolveCustomerOpenid(ctx, 5, { preferMini: true })).toBe('o-mini');
        expect(await makeService(both).resolveCustomerOpenid(ctx, 5, { preferMini: false })).toBe('o-official');
        expect(await makeService(both).resolveCustomerOpenid(ctx, 5)).toBe('o-official');
    });

    it('仅存其一则用之', async () => {
        expect(await makeService({ wechatOpenid: 'o-official' }).resolveCustomerOpenid(ctx, 5)).toBe('o-official');
        expect(await makeService({ wechatMiniOpenid: 'o-mini' }).resolveCustomerOpenid(ctx, 5)).toBe('o-mini');
    });
});
