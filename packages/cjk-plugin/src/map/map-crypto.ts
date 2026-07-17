import { encrypt, decrypt, isEncrypted } from '../auth/crypto';
import type { MapProviderConfig } from './map-config';

const SECRET_FIELDS: (keyof MapProviderConfig)[] = ['apiKey', 'securityJsCode'];

export function encryptMapConfig(config: MapProviderConfig | null): MapProviderConfig | null {
    if (!config) return null;
    const out: MapProviderConfig = { ...config };
    for (const field of SECRET_FIELDS) {
        const val = out[field];
        if (typeof val === 'string' && val && !isEncrypted(val)) {
            (out as any)[field] = encrypt(val);
        }
    }
    return out;
}

export function decryptMapConfig(config: MapProviderConfig | null): MapProviderConfig | null {
    if (!config) return null;
    const out: MapProviderConfig = { ...config };
    for (const field of SECRET_FIELDS) {
        const val = out[field];
        if (typeof val === 'string' && val && isEncrypted(val)) {
            (out as any)[field] = decrypt(val);
        }
    }
    return out;
}

export function maskMapConfig(config: MapProviderConfig | null): MapProviderConfig | null {
    if (!config) return null;
    const out: MapProviderConfig = { ...config };
    for (const field of SECRET_FIELDS) {
        if (typeof out[field] === 'string' && out[field]) {
            (out as any)[field] = '*******';
        }
    }
    return out;
}

export function mergeMapConfig(original: MapProviderConfig | null, patch: Partial<MapProviderConfig> | null): MapProviderConfig | null {
    if (!patch) return original;
    const out: MapProviderConfig = { ...(original || { provider: 'amap', apiKey: '' }) };
    for (const key of Object.keys(patch) as (keyof MapProviderConfig)[]) {
        const val = patch[key];
        if (val === '***') continue;
        (out as any)[key] = val;
    }
    return out;
}
