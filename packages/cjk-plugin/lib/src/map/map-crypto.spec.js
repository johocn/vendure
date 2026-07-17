"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const map_crypto_1 = require("./map-crypto");
(0, vitest_1.describe)('map-crypto', () => {
    const plain = {
        provider: 'amap',
        apiKey: 'amap-key-123456',
        securityJsCode: 'security-abc',
    };
    (0, vitest_1.it)('encrypts apiKey and securityJsCode with enc: prefix', () => {
        const enc = (0, map_crypto_1.encryptMapConfig)(plain);
        (0, vitest_1.expect)(enc.apiKey).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.securityJsCode).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.provider).toBe('amap');
    });
    (0, vitest_1.it)('decrypts back to original', () => {
        const enc = (0, map_crypto_1.encryptMapConfig)(plain);
        const dec = (0, map_crypto_1.decryptMapConfig)(enc);
        (0, vitest_1.expect)(dec).toEqual(plain);
    });
    (0, vitest_1.it)('masks secrets with *******', () => {
        const masked = (0, map_crypto_1.maskMapConfig)(plain);
        (0, vitest_1.expect)(masked.apiKey).toBe('*******');
        (0, vitest_1.expect)(masked.securityJsCode).toBe('*******');
        (0, vitest_1.expect)(masked.provider).toBe('amap');
    });
    (0, vitest_1.it)('merges with *** keeping original', () => {
        const merged = (0, map_crypto_1.mergeMapConfig)(plain, { apiKey: '***', securityJsCode: 'new-sec' });
        (0, vitest_1.expect)(merged.apiKey).toBe('amap-key-123456');
        (0, vitest_1.expect)(merged.securityJsCode).toBe('new-sec');
    });
    (0, vitest_1.it)('merges with empty string clearing value', () => {
        const merged = (0, map_crypto_1.mergeMapConfig)(plain, { apiKey: '' });
        (0, vitest_1.expect)(merged.apiKey).toBe('');
    });
    (0, vitest_1.it)('handles null input gracefully', () => {
        (0, vitest_1.expect)((0, map_crypto_1.encryptMapConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, map_crypto_1.decryptMapConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, map_crypto_1.maskMapConfig)(null)).toBeNull();
    });
    (0, vitest_1.it)('handles undefined securityJsCode', () => {
        const noSec = { provider: 'amap', apiKey: 'key' };
        const enc = (0, map_crypto_1.encryptMapConfig)(noSec);
        (0, vitest_1.expect)(enc.apiKey).toMatch(/^enc:/);
        (0, vitest_1.expect)(enc.securityJsCode).toBeUndefined();
        const dec = (0, map_crypto_1.decryptMapConfig)(enc);
        (0, vitest_1.expect)(dec).toEqual(noSec);
    });
});
//# sourceMappingURL=map-crypto.spec.js.map