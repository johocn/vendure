import { encrypt, decrypt, isEncrypted } from '../auth/crypto';
import type { AlipayCredentials, DouyinpayCredentials, PayConfig, WechatpayCredentials } from './payment-config.types';

const ALIPAY_SECRETS: (keyof AlipayCredentials)[] = ['privateKey'];
const WECHATPAY_SECRETS: (keyof WechatpayCredentials)[] = ['privateKey', 'apiKey'];
const DOUYINPAY_SECRETS: (keyof DouyinpayCredentials)[] = ['appSecret', 'privateKey'];

function encryptFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
    const out = { ...obj };
    for (const f of fields) {
        const v = out[f];
        if (typeof v === 'string' && v && !isEncrypted(v)) (out as any)[f] = encrypt(v);
    }
    return out;
}
function decryptFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
    const out = { ...obj };
    for (const f of fields) {
        const v = out[f];
        if (typeof v === 'string' && v && isEncrypted(v)) (out as any)[f] = decrypt(v);
    }
    return out;
}
function maskFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]): T {
    const out = { ...obj };
    for (const f of fields) {
        if (typeof out[f] === 'string' && out[f]) (out as any)[f] = '*******';
    }
    return out;
}
function mergeFields<T extends Record<string, any>>(original: T | undefined, patch: Partial<T> | undefined): T | undefined {
    if (!patch) return original;
    if (!original) {
        const out: any = {};
        for (const k of Object.keys(patch) as (keyof T)[]) (out as any)[k] = patch[k] === '***' ? '' : patch[k];
        return out;
    }
    const out = { ...original };
    for (const k of Object.keys(patch) as (keyof T)[]) {
        const v = patch[k];
        if (v === '***') continue;
        (out as any)[k] = v;
    }
    return out;
}

export function encryptPayConfig(config: PayConfig | null): PayConfig | null {
    if (!config) return null;
    const out: PayConfig = {};
    if (config.alipay) out.alipay = encryptFields(config.alipay, ALIPAY_SECRETS);
    if (config.wechatpay) out.wechatpay = encryptFields(config.wechatpay, WECHATPAY_SECRETS);
    if (config.douyinpay) out.douyinpay = encryptFields(config.douyinpay, DOUYINPAY_SECRETS);
    return out;
}

export function decryptPayConfig(config: PayConfig | null): PayConfig | null {
    if (!config) return null;
    const out: PayConfig = {};
    if (config.alipay) out.alipay = decryptFields(config.alipay, ALIPAY_SECRETS);
    if (config.wechatpay) out.wechatpay = decryptFields(config.wechatpay, WECHATPAY_SECRETS);
    if (config.douyinpay) out.douyinpay = decryptFields(config.douyinpay, DOUYINPAY_SECRETS);
    return out;
}

export function maskPayConfig(config: PayConfig | null): PayConfig | null {
    if (!config) return null;
    const out: PayConfig = {};
    if (config.alipay) out.alipay = maskFields(config.alipay, ALIPAY_SECRETS);
    if (config.wechatpay) out.wechatpay = maskFields(config.wechatpay, WECHATPAY_SECRETS);
    if (config.douyinpay) out.douyinpay = maskFields(config.douyinpay, DOUYINPAY_SECRETS);
    return out;
}

export function mergePayConfig(original: PayConfig | null, patch: Partial<PayConfig> | null): PayConfig | null {
    if (!patch) return original;
    const base = original || {};
    return {
        alipay: mergeFields(base.alipay, patch.alipay),
        wechatpay: mergeFields(base.wechatpay, patch.wechatpay),
        douyinpay: mergeFields(base.douyinpay, patch.douyinpay),
    };
}
