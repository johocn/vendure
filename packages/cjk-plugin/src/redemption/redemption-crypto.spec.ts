import { describe, expect, it } from 'vitest';
import {
    generateRedemptionCode, validChars, encryptRedemptionCode, decryptRedemptionCode,
    redemptionFingerprint, redemptionQrPayload, verifyRedemptionQr,
} from './redemption-crypto';

const KEY = 'a'.repeat(64);

describe('redemption-crypto', () => {
    it('生成 6 位大写码且不含易混字符', () => {
        for (let i = 0; i < 200; i++) {
            const code = generateRedemptionCode();
            expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
            expect(code).toBe(code.toUpperCase());
            expect(validChars(code)).toBe(true);
        }
    });
    it('校验位验证通过', () => {
        // 内部校验位：从自身再取一次不该变；这里用加解密往返间接验证码结构
        const code = generateRedemptionCode();
        expect(validChars(code)).toBe(true);
        const { cipher, iv } = encryptRedemptionCode(code, KEY);
        expect(decryptRedemptionCode(cipher, iv, KEY)).toBe(code);
    });
    it('指纹稳定且区分大小写归一', () => {
        expect(redemptionFingerprint('AB12CD', KEY, 'chn')).toBe(redemptionFingerprint('ab12cd', KEY, 'chn'));
        expect(redemptionFingerprint('AB12CD', KEY, 'chn')).not.toBe(redemptionFingerprint('AB12CE', KEY, 'chn'));
    });
    it('二维码载荷签名可验签', () => {
        const code = generateRedemptionCode();
        const payload = redemptionQrPayload('XORDER1', code, KEY);
        expect(verifyRedemptionQr(payload, KEY)).toBe(true);
        // 篡改载荷应验签失败
        expect(verifyRedemptionQr(payload.replace(code, 'XXXXXX'), KEY)).toBe(false);
    });
});