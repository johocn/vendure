// e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { RequestContext } from '@vendure/core';
import type { TenantAuthConfig } from './auth-config.types';

const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';

// 通过 setter 注入 authSecret，避免对 plugin.ts 的反向导入循环依赖
let _authSecret: string | undefined;
export function setAuthSecret(secret: string | undefined) {
    _authSecret = secret;
}

function getKey(): Buffer {
    const secret = _authSecret || process.env.AUTH_SECRET || 'default-dev-key-change-in-prod';
    return scryptSync(secret, 'vendure-auth-salt', 32);
}

export function encrypt(plain: string): string {
    if (!plain) return plain;
    if (plain.startsWith(ENC_PREFIX)) return plain; // 已加密
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload: string): string {
    if (!payload || !payload.startsWith(ENC_PREFIX)) return payload;
    try {
        const [, ivHex, tagHex, encHex] = payload.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = createDecipheriv(ALGO, getKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch (e) {
        return '';
    }
}

export function isEncrypted(value: string): boolean {
    return value?.startsWith(ENC_PREFIX) ?? false;
}

/** 加密 domain 形状 authConfig 中所有敏感字段（原地修改） */
export function encryptAuthConfig(config: any): any {
    if (!config) return config;
    const result = JSON.parse(JSON.stringify(config));

    if (result.overrides?.wechat) {
        const w = result.overrides.wechat;
        if (w.appSecret) w.appSecret = encrypt(w.appSecret);
        if (w.miniProgramAppSecret) w.miniProgramAppSecret = encrypt(w.miniProgramAppSecret);
        if (w.encodingAESKey) w.encodingAESKey = encrypt(w.encodingAESKey);
    }
    if (result.overrides?.phone?.accessKeySecret) {
        result.overrides.phone.accessKeySecret = encrypt(result.overrides.phone.accessKeySecret);
    }
    if (result.overrides?.alipay?.privateKey) {
        result.overrides.alipay.privateKey = encrypt(result.overrides.alipay.privateKey);
    }
    if (result.overrides?.douyin) {
        const d = result.overrides.douyin;
        if (d.appSecret) d.appSecret = encrypt(d.appSecret);
        if (d.miniProgramAppSecret) d.miniProgramAppSecret = encrypt(d.miniProgramAppSecret);
    }

    if (result.ssoProviders) {
        for (const p of result.ssoProviders) {
            if (p.clientSecret) p.clientSecret = encrypt(p.clientSecret);
        }
    }

    return result;
}

/** 解密 domain 形状 authConfig 中所有敏感字段 */
export function decryptAuthConfig(config: any): any {
    if (!config) return config;
    const result = JSON.parse(JSON.stringify(config));

    if (result.overrides?.wechat) {
        const w = result.overrides.wechat;
        if (w.appSecret) w.appSecret = decrypt(w.appSecret);
        if (w.miniProgramAppSecret) w.miniProgramAppSecret = decrypt(w.miniProgramAppSecret);
        if (w.encodingAESKey) w.encodingAESKey = decrypt(w.encodingAESKey);
    }
    if (result.overrides?.phone?.accessKeySecret) {
        result.overrides.phone.accessKeySecret = decrypt(result.overrides.phone.accessKeySecret);
    }
    if (result.overrides?.alipay?.privateKey) {
        result.overrides.alipay.privateKey = decrypt(result.overrides.alipay.privateKey);
    }
    if (result.overrides?.douyin) {
        const d = result.overrides.douyin;
        if (d.appSecret) d.appSecret = decrypt(d.appSecret);
        if (d.miniProgramAppSecret) d.miniProgramAppSecret = decrypt(d.miniProgramAppSecret);
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) {
            if (p.clientSecret) p.clientSecret = decrypt(p.clientSecret);
        }
    }

    return result;
}

/** 脱敏 authConfig（管理后台读取用，secret 返回 ***） */
export function maskAuthConfig(config: any): any {
    if (!config) return config;
    const result = JSON.parse(JSON.stringify(config));

    const maskField = (obj: any, field: string) => {
        if (obj?.[field]) obj[field] = '***';
    };

    if (result.overrides?.wechat) {
        maskField(result.overrides.wechat, 'appSecret');
        maskField(result.overrides.wechat, 'miniProgramAppSecret');
        maskField(result.overrides.wechat, 'encodingAESKey');
    }
    if (result.overrides?.phone) maskField(result.overrides.phone, 'accessKeySecret');
    if (result.overrides?.alipay) maskField(result.overrides.alipay, 'privateKey');
    if (result.overrides?.douyin) {
        maskField(result.overrides.douyin, 'appSecret');
        maskField(result.overrides.douyin, 'miniProgramAppSecret');
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) maskField(p, 'clientSecret');
    }

    return result;
}

/** 合并保存：新值中 *** 表示保留原值，最终结果为加密后的 domain 形状 */
export function mergeAuthConfig(original: any, incoming: any): any {
    if (!original) return encryptAuthConfig(incoming);
    if (!incoming) return original;

    const result = JSON.parse(JSON.stringify(incoming));

    const mergeField = (origObj: any, newObj: any, field: string) => {
        if (newObj?.[field] === '***' && origObj?.[field]) {
            newObj[field] = origObj[field]; // 保留原加密值
        }
    };

    if (result.overrides?.wechat) {
        mergeField(original.overrides?.wechat, result.overrides.wechat, 'appSecret');
        mergeField(original.overrides?.wechat, result.overrides.wechat, 'miniProgramAppSecret');
        mergeField(original.overrides?.wechat, result.overrides.wechat, 'encodingAESKey');
    }
    if (result.overrides?.phone) mergeField(original.overrides?.phone, result.overrides.phone, 'accessKeySecret');
    if (result.overrides?.alipay) mergeField(original.overrides?.alipay, result.overrides.alipay, 'privateKey');
    if (result.overrides?.douyin) {
        mergeField(original.overrides?.douyin, result.overrides.douyin, 'appSecret');
        mergeField(original.overrides?.douyin, result.overrides.douyin, 'miniProgramAppSecret');
    }
    if (result.ssoProviders && original.ssoProviders) {
        for (const newP of result.ssoProviders) {
            const origP = original.ssoProviders.find((p: any) => p.providerKey === newP.providerKey);
            mergeField(origP, newP, 'clientSecret');
        }
    }

    return encryptAuthConfig(result);
}

/**
 * 把 struct 原始值（{ enabledMethods, overridesJson, ssoProvidersJson }）解析+解密为 domain 配置。
 * 不依赖 ctx，纯函数，可用于任意来源的 struct 数据。
 */
export function parseAndDecryptStruct(rawStruct: any): TenantAuthConfig | null {
    if (!rawStruct) return null;
    const domain: any = { enabledMethods: rawStruct.enabledMethods || [] };
    if (rawStruct.overridesJson) {
        try { domain.overrides = JSON.parse(rawStruct.overridesJson); } catch { domain.overrides = {}; }
    }
    if (rawStruct.ssoProvidersJson) {
        try { domain.ssoProviders = JSON.parse(rawStruct.ssoProvidersJson); } catch { domain.ssoProviders = []; }
    }
    return decryptAuthConfig(domain);
}

/** 把 struct 原始值解析+解密为 domain 配置；无配置返回 null。策略/resolver 读取的统一入口 */
export function readChannelAuthConfig(ctx: RequestContext): TenantAuthConfig | null {
    const raw = (ctx.channel as any)?.customFields?.authConfig;
    return parseAndDecryptStruct(raw);
}

/** 策略用：取某方式的已解密凭证覆盖，无则 null */
export function getAuthOverride(ctx: RequestContext, method: string): any | null {
    const config = readChannelAuthConfig(ctx);
    return (config?.overrides as Record<string, any> | undefined)?.[method] || null;
}

/** 把 domain 配置加密+序列化为 struct 形状（供写入 customFields.authConfig） */
export function serializeAuthConfigToStruct(domain: TenantAuthConfig | null): any {
    if (!domain) return null;
    const encrypted = encryptAuthConfig(domain);
    return {
        enabledMethods: encrypted.enabledMethods || [],
        overridesJson: encrypted.overrides ? JSON.stringify(encrypted.overrides) : '',
        ssoProvidersJson: encrypted.ssoProviders ? JSON.stringify(encrypted.ssoProviders) : '',
    };
}
