"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pay_config_crypto_1 = require("./pay-config-crypto");
(0, vitest_1.describe)('pay-config-crypto', () => {
    const plain = {
        alipay: { appId: 'alipay-app', privateKey: 'pk-secret', tradeType: 'WAP' },
        wechatpay: { appId: 'wx-app', mchId: 'mch1', publicKey: 'pub', privateKey: 'wx-pk', apiKey: 'wx-ak', serialNo: 's1', tradeType: 'JSAPI' },
        douyinpay: { appId: 'dy-app', appSecret: 'dy-secret', mchId: 'dy-mch', privateKey: 'dy-pk', tradeType: 'QR' },
    };
    (0, vitest_1.it)('encrypts privateKey/apiKey/appSecret fields', () => {
        const enc = (0, pay_config_crypto_1.encryptPayConfig)(plain);
        (0, vitest_1.expect)(enc.alipay.privateKey).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.wechatpay.privateKey).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.wechatpay.apiKey).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.douyinpay.appSecret).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.douyinpay.privateKey).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.alipay.appId).toBe('alipay-app');
        (0, vitest_1.expect)(enc.wechatpay.mchId).toBe('mch1');
    });
    (0, vitest_1.it)('decrypts back to original', () => {
        const enc = (0, pay_config_crypto_1.encryptPayConfig)(plain);
        (0, vitest_1.expect)((0, pay_config_crypto_1.decryptPayConfig)(enc)).toEqual(plain);
    });
    (0, vitest_1.it)('masks secret fields', () => {
        const masked = (0, pay_config_crypto_1.maskPayConfig)(plain);
        (0, vitest_1.expect)(masked.alipay.privateKey).toBe('*******');
        (0, vitest_1.expect)(masked.wechatpay.apiKey).toBe('*******');
        (0, vitest_1.expect)(masked.douyinpay.appSecret).toBe('*******');
        (0, vitest_1.expect)(masked.alipay.appId).toBe('alipay-app');
    });
    (0, vitest_1.it)('merges per-platform with *** semantics', () => {
        const merged = (0, pay_config_crypto_1.mergePayConfig)(plain, {
            alipay: { privateKey: '***', appId: 'new-app' },
        });
        (0, vitest_1.expect)(merged.alipay.privateKey).toBe('pk-secret');
        (0, vitest_1.expect)(merged.alipay.appId).toBe('new-app');
        (0, vitest_1.expect)(merged.wechatpay).toEqual(plain.wechatpay);
    });
    (0, vitest_1.it)('handles partial config (only alipay)', () => {
        const partial = { alipay: plain.alipay };
        const enc = (0, pay_config_crypto_1.encryptPayConfig)(partial);
        (0, vitest_1.expect)(enc.wechatpay).toBeUndefined();
        (0, vitest_1.expect)(enc.douyinpay).toBeUndefined();
        (0, vitest_1.expect)((0, pay_config_crypto_1.decryptPayConfig)(enc)).toEqual(partial);
    });
    (0, vitest_1.it)('handles null', () => {
        (0, vitest_1.expect)((0, pay_config_crypto_1.encryptPayConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, pay_config_crypto_1.decryptPayConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, pay_config_crypto_1.maskPayConfig)(null)).toBeNull();
    });
});
//# sourceMappingURL=pay-config-crypto.spec.js.map