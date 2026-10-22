import { describe, expect, it } from 'vitest';
import { buildMeituanParams, buildMeituanSign, verifyMeituanCallback } from './meituan-signature';

const base = { appkey: 'mt-appkey', timestamp: '1700000000', version: '1.0' };
const API_URL = 'https://peisongopen.meituan.com/api/order/create';

describe('meituan-signature', () => {
    it('legacy: MD5(appkey+timestamp+version+appSecret)', () => {
        expect(buildMeituanSign(base, 'mt-secret', 'legacy')).toBe('bfee0c6f9c29c7f332a007ec3fd14d41');
    });

    it('open: MD5(url?k=v&...&appSecret=secret)，参数按键名升序', () => {
        expect(buildMeituanSign(base, 'mt-secret', 'open', API_URL)).toBe('bdbb31489b3c62bfdc13d8774305896f');
    });

    it('buildMeituanParams 返回 appkey/timestamp/version/body/sign', () => {
        const p = buildMeituanParams('mt-appkey', 'mt-secret', 'legacy', { delivery_id: 'WM1' }, 1700000000);
        expect(p).toMatchObject({ appkey: 'mt-appkey', timestamp: '1700000000', version: '1.0', sign: 'bfee0c6f9c29c7f332a007ec3fd14d41' });
        expect(JSON.parse(p.body)).toEqual({ delivery_id: 'WM1' });
    });

    it('verifyMeituanCallback 对篡改返回 false', () => {
        const payload = { ...base, order_id: 'MT1', status: '20', sign: buildMeituanSign(base, 'mt-secret', 'legacy') };
        expect(verifyMeituanCallback(payload, 'mt-secret', 'legacy')).toBe(true);
        // legacy 签名只覆盖 appkey/timestamp/version，篡改参与签名的字段才应失败
        expect(verifyMeituanCallback({ ...payload, timestamp: '1700000001' }, 'mt-secret', 'legacy')).toBe(false);
    });

    it('open 模式回调验签：合法 true，缺 apiUrl 返回 false 而不抛异常', () => {
        // open 模式下 body 也参与签名，回调 payload 需带上 body
        const signed = buildMeituanParams('mt-appkey', 'mt-secret', 'open', { order_id: 'MT1', status: '20' }, 1700000000, API_URL);
        const payload = { ...signed };
        expect(verifyMeituanCallback(payload, 'mt-secret', 'open', API_URL)).toBe(true);
        expect(verifyMeituanCallback(payload, 'mt-secret', 'open')).toBe(false);
        expect(verifyMeituanCallback({ ...payload, timestamp: '1700000001' }, 'mt-secret', 'open', API_URL)).toBe(false);
    });
});
