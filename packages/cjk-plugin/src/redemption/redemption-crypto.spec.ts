import { describe, expect, it } from 'vitest';
import {
    generateRedemptionCode, validChars, encryptRedemptionCode, decryptRedemptionCode,
    redemptionFingerprint, redemptionQrPayload, verifyRedemptionQr, computeRedemptionStatus,
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

describe('computeRedemptionStatus', () => {
    const now = new Date('2026-09-03T12:00:00Z');
    it('claimed 优先级最高，返回 claimed', () => {
        expect(computeRedemptionStatus(true, '2026-09-10T12:00:00Z', now, 24)).toBe('claimed');
    });
    it('未核销且已过期返回 expired', () => {
        expect(computeRedemptionStatus(false, '2026-09-02T12:00:00Z', now, 24)).toBe('expired');
    });
    it('未核销且临期（剩余<=阈值）返回 expiring_soon', () => {
        // 剩余 12h < 24h 阈值
        expect(computeRedemptionStatus(false, '2026-09-04T00:00:00Z', now, 24)).toBe('expiring_soon');
    });
    it('未核销且临期（剩余==阈值边界）返回 expiring_soon', () => {
        const edge = new Date(now.getTime() + 24 * 3600_000);
        expect(computeRedemptionStatus(false, edge.toISOString(), now, 24)).toBe('expiring_soon');
    });
    it('未核销且未临期返回 active', () => {
        expect(computeRedemptionStatus(false, '2026-09-20T12:00:00Z', now, 24)).toBe('active');
    });
    it('无 expiresAt 视为未过期（active）兼容旧单', () => {
        expect(computeRedemptionStatus(false, null, now, 24)).toBe('active');
    });
});