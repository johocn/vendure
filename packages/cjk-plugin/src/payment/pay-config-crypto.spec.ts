import { describe, it, expect } from 'vitest';
import { encryptPayConfig, decryptPayConfig, maskPayConfig, mergePayConfig } from './pay-config-crypto';
import type { PayConfig } from './payment-config.types';

describe('pay-config-crypto', () => {
    const plain: PayConfig = {
        alipay: { appId: 'alipay-app', privateKey: 'pk-secret', tradeType: 'WAP' },
        wechatpay: { appId: 'wx-app', mchId: 'mch1', publicKey: 'pub', privateKey: 'wx-pk', apiKey: 'wx-ak', serialNo: 's1', tradeType: 'JSAPI' },
        douyinpay: { appId: 'dy-app', appSecret: 'dy-secret', mchId: 'dy-mch', privateKey: 'dy-pk', tradeType: 'QR' },
    };

    it('encrypts privateKey/apiKey/appSecret fields', () => {
        const enc = encryptPayConfig(plain)!;
        expect(enc.alipay!.privateKey).toMatch(/^enc:/);
        expect(enc.wechatpay!.privateKey).toMatch(/^enc:/);
        expect(enc.wechatpay!.apiKey).toMatch(/^enc:/);
        expect(enc.douyinpay!.appSecret).toMatch(/^enc:/);
        expect(enc.douyinpay!.privateKey).toMatch(/^enc:/);
        expect(enc.alipay!.appId).toBe('alipay-app');
        expect(enc.wechatpay!.mchId).toBe('mch1');
    });

    it('decrypts back to original', () => {
        const enc = encryptPayConfig(plain)!;
        expect(decryptPayConfig(enc)).toEqual(plain);
    });

    it('masks secret fields', () => {
        const masked = maskPayConfig(plain)!;
        expect(masked.alipay!.privateKey).toBe('*******');
        expect(masked.wechatpay!.apiKey).toBe('*******');
        expect(masked.douyinpay!.appSecret).toBe('*******');
        expect(masked.alipay!.appId).toBe('alipay-app');
    });

    it('merges per-platform with *** semantics', () => {
        const merged = mergePayConfig(plain, {
            alipay: { privateKey: '***', appId: 'new-app' },
        })!;
        expect(merged.alipay!.privateKey).toBe('pk-secret');
        expect(merged.alipay!.appId).toBe('new-app');
        expect(merged.wechatpay).toEqual(plain.wechatpay);
    });

    it('handles partial config (only alipay)', () => {
        const partial: PayConfig = { alipay: plain.alipay };
        const enc = encryptPayConfig(partial)!;
        expect(enc.wechatpay).toBeUndefined();
        expect(enc.douyinpay).toBeUndefined();
        expect(decryptPayConfig(enc)).toEqual(partial);
    });

    it('handles null', () => {
        expect(encryptPayConfig(null)).toBeNull();
        expect(decryptPayConfig(null)).toBeNull();
        expect(maskPayConfig(null)).toBeNull();
    });
});
