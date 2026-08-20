"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dada_signature_1 = require("./dada-signature");
(0, vitest_1.describe)('dada-signature', () => {
    (0, vitest_1.it)('buildParamString: ASCII 升序 + key1value1 直连拼接（固化官方样式）', () => {
        const params = { app_key: 'test-app-key', body: '{"a":1}', format: 'json', timestamp: '1700000000', v: '1.0' };
        (0, vitest_1.expect)((0, dada_signature_1.buildParamString)(params)).toBe('app_keytest-app-keybody{"a":1}formatjsontimestamp1700000000v1.0');
    });
    (0, vitest_1.it)('sign: MD5(app_secret+拼接串+app_secret).toUpperCase()（固定向量）', () => {
        (0, vitest_1.expect)((0, dada_signature_1.sign)('test-secret', 'app_keytest-app-keybody{"a":1}formatjsontimestamp1700000000v1.0'))
            .toBe('69B39F58949AD93E3E73FACE26359F03');
    });
    (0, vitest_1.it)('buildSignedParams 产出标准公共参数 + 合法签名（固定向量）', () => {
        const signed = (0, dada_signature_1.buildSignedParams)('test-app-key', 'test-secret', { a: 1 }, { timestamp: 1700000000 });
        (0, vitest_1.expect)(signed.format).toBe('json');
        (0, vitest_1.expect)(signed.v).toBe('1.0');
        (0, vitest_1.expect)(signed.timestamp).toBe('1700000000');
        (0, vitest_1.expect)(signed.signature).toBe('69B39F58949AD93E3E73FACE26359F03');
    });
    (0, vitest_1.it)('buildSignedParams 支持 source_id', () => {
        const signed = (0, dada_signature_1.buildSignedParams)('k', 's', {}, { sourceId: 'shop1', timestamp: 1700000000 });
        (0, vitest_1.expect)(signed.source_id).toBe('shop1');
        (0, vitest_1.expect)(signed.signature).toMatch(/^[0-9A-F]{32}$/);
    });
    (0, vitest_1.it)('verifyCallbackSignature: 正确签名通过（固定向量）', () => {
        const payload = {
            app_key: 'test-app-key',
            body: '{"order_id":"TDS1","order_status":2}',
            format: 'json',
            source_id: 'shop1',
            timestamp: '1700000000',
            v: '1.0',
            signature: 'D1B090356E7A73453CF12D18F39F02A1',
        };
        (0, vitest_1.expect)((0, dada_signature_1.verifyCallbackSignature)(payload, 'test-secret')).toBe(true);
    });
    (0, vitest_1.it)('verifyCallbackSignature: 篡改业务字段不通过', () => {
        const payload = {
            app_key: 'test-app-key',
            body: '{"order_id":"TDS1","order_status":5}',
            format: 'json',
            source_id: 'shop1',
            timestamp: '1700000000',
            v: '1.0',
            signature: 'D1B090356E7A73453CF12D18F39F02A1',
        };
        (0, vitest_1.expect)((0, dada_signature_1.verifyCallbackSignature)(payload, 'test-secret')).toBe(false);
    });
    (0, vitest_1.it)('verifyCallbackSignature: 缺 signature / 非对象均不通过', () => {
        (0, vitest_1.expect)((0, dada_signature_1.verifyCallbackSignature)({ app_key: 'k' }, 's')).toBe(false);
        (0, vitest_1.expect)((0, dada_signature_1.verifyCallbackSignature)(null, 's')).toBe(false);
        (0, vitest_1.expect)((0, dada_signature_1.verifyCallbackSignature)('x', 's')).toBe(false);
    });
});
//# sourceMappingURL=dada-signature.spec.js.map