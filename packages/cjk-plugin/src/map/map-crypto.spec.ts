import { describe, it, expect } from 'vitest';
import { encryptMapConfig, decryptMapConfig, maskMapConfig, mergeMapConfig } from './map-crypto';
import type { MapProviderConfig } from './map-config';

describe('map-crypto', () => {
    const plain: MapProviderConfig = {
        provider: 'amap',
        apiKey: 'amap-key-123456',
        securityJsCode: 'security-abc',
    };

    it('encrypts apiKey and securityJsCode with enc: prefix', () => {
        const enc = encryptMapConfig(plain)!;
        expect(enc.apiKey).toMatch(/^enc:/);
        expect(enc.securityJsCode).toMatch(/^enc:/);
        expect(enc.provider).toBe('amap');
    });

    it('decrypts back to original', () => {
        const enc = encryptMapConfig(plain);
        const dec = decryptMapConfig(enc);
        expect(dec).toEqual(plain);
    });

    it('masks secrets with *******', () => {
        const masked = maskMapConfig(plain)!;
        expect(masked.apiKey).toBe('*******');
        expect(masked.securityJsCode).toBe('*******');
        expect(masked.provider).toBe('amap');
    });

    it('merges with *** keeping original', () => {
        const merged = mergeMapConfig(plain, { apiKey: '***', securityJsCode: 'new-sec' })!;
        expect(merged.apiKey).toBe('amap-key-123456');
        expect(merged.securityJsCode).toBe('new-sec');
    });

    it('merges with empty string clearing value', () => {
        const merged = mergeMapConfig(plain, { apiKey: '' })!;
        expect(merged.apiKey).toBe('');
    });

    it('handles null input gracefully', () => {
        expect(encryptMapConfig(null)).toBeNull();
        expect(decryptMapConfig(null)).toBeNull();
        expect(maskMapConfig(null)).toBeNull();
    });

    it('handles undefined securityJsCode', () => {
        const noSec: MapProviderConfig = { provider: 'amap', apiKey: 'key' };
        const enc = encryptMapConfig(noSec)!;
        expect(enc.apiKey).toMatch(/^enc:/);
        expect(enc.securityJsCode).toBeUndefined();
        const dec = decryptMapConfig(enc);
        expect(dec).toEqual(noSec);
    });
});
