import { describe, it, expect } from 'vitest';
import { buildParamString, sign, buildSignedParams, verifyCallbackSignature } from './dada-signature';

describe('dada-signature', () => {
    it('buildParamString: ASCII 升序 + key1value1 直连拼接（固化官方样式）', () => {
        const params = { app_key: 'test-app-key', body: '{"a":1}', format: 'json', timestamp: '1700000000', v: '1.0' };
        expect(buildParamString(params)).toBe('app_keytest-app-keybody{"a":1}formatjsontimestamp1700000000v1.0');
    });

    it('sign: MD5(app_secret+拼接串+app_secret).toUpperCase()（固定向量）', () => {
        expect(sign('test-secret', 'app_keytest-app-keybody{"a":1}formatjsontimestamp1700000000v1.0'))
            .toBe('69B39F58949AD93E3E73FACE26359F03');
    });

    it('buildSignedParams 产出标准公共参数 + 合法签名（固定向量）', () => {
        const signed = buildSignedParams('test-app-key', 'test-secret', { a: 1 }, { timestamp: 1700000000 });
        expect(signed.format).toBe('json');
        expect(signed.v).toBe('1.0');
        expect(signed.timestamp).toBe('1700000000');
        expect(signed.signature).toBe('69B39F58949AD93E3E73FACE26359F03');
    });

    it('buildSignedParams 支持 source_id', () => {
        const signed = buildSignedParams('k', 's', {}, { sourceId: 'shop1', timestamp: 1700000000 });
        expect(signed.source_id).toBe('shop1');
        expect(signed.signature).toMatch(/^[0-9A-F]{32}$/);
    });

    it('verifyCallbackSignature: 正确签名通过（固定向量）', () => {
        const payload = {
            app_key: 'test-app-key',
            body: '{"order_id":"TDS1","order_status":2}',
            format: 'json',
            source_id: 'shop1',
            timestamp: '1700000000',
            v: '1.0',
            signature: 'D1B090356E7A73453CF12D18F39F02A1',
        };
        expect(verifyCallbackSignature(payload, 'test-secret')).toBe(true);
    });

    it('verifyCallbackSignature: 篡改业务字段不通过', () => {
        const payload = {
            app_key: 'test-app-key',
            body: '{"order_id":"TDS1","order_status":5}',
            format: 'json',
            source_id: 'shop1',
            timestamp: '1700000000',
            v: '1.0',
            signature: 'D1B090356E7A73453CF12D18F39F02A1',
        };
        expect(verifyCallbackSignature(payload, 'test-secret')).toBe(false);
    });

    it('verifyCallbackSignature: 缺 signature / 非对象均不通过', () => {
        expect(verifyCallbackSignature({ app_key: 'k' }, 's')).toBe(false);
        expect(verifyCallbackSignature(null, 's')).toBe(false);
        expect(verifyCallbackSignature('x', 's')).toBe(false);
    });
});
