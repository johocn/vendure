"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAuthSecret = setAuthSecret;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.isEncrypted = isEncrypted;
exports.encryptAuthConfig = encryptAuthConfig;
exports.decryptAuthConfig = decryptAuthConfig;
exports.maskAuthConfig = maskAuthConfig;
exports.mergeAuthConfig = mergeAuthConfig;
exports.parseAndDecryptStruct = parseAndDecryptStruct;
exports.readChannelAuthConfig = readChannelAuthConfig;
exports.getAuthOverride = getAuthOverride;
exports.serializeAuthConfigToStruct = serializeAuthConfigToStruct;
// e:\code\vendure\packages\cjk-plugin\src\auth\crypto.ts
const crypto_1 = require("crypto");
const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';
// 通过 setter 注入 authSecret，避免对 plugin.ts 的反向导入循环依赖
let _authSecret;
function setAuthSecret(secret) {
    _authSecret = secret;
}
function getKey() {
    const secret = _authSecret || process.env.AUTH_SECRET || 'default-dev-key-change-in-prod';
    return (0, crypto_1.scryptSync)(secret, 'vendure-auth-salt', 32);
}
function encrypt(plain) {
    if (!plain)
        return plain;
    if (plain.startsWith(ENC_PREFIX))
        return plain; // 已加密
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)(ALGO, getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}
function decrypt(payload) {
    if (!payload || !payload.startsWith(ENC_PREFIX))
        return payload;
    try {
        const [, ivHex, tagHex, encHex] = payload.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = (0, crypto_1.createDecipheriv)(ALGO, getKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    }
    catch (e) {
        return '';
    }
}
function isEncrypted(value) {
    var _a;
    return (_a = value === null || value === void 0 ? void 0 : value.startsWith(ENC_PREFIX)) !== null && _a !== void 0 ? _a : false;
}
/** 加密 domain 形状 authConfig 中所有敏感字段（原地修改） */
function encryptAuthConfig(config) {
    var _a, _b, _c, _d, _e, _f;
    if (!config)
        return config;
    const result = JSON.parse(JSON.stringify(config));
    if ((_a = result.overrides) === null || _a === void 0 ? void 0 : _a.wechat) {
        const w = result.overrides.wechat;
        if (w.appSecret)
            w.appSecret = encrypt(w.appSecret);
        if (w.miniProgramAppSecret)
            w.miniProgramAppSecret = encrypt(w.miniProgramAppSecret);
        if (w.encodingAESKey)
            w.encodingAESKey = encrypt(w.encodingAESKey);
    }
    if ((_c = (_b = result.overrides) === null || _b === void 0 ? void 0 : _b.phone) === null || _c === void 0 ? void 0 : _c.accessKeySecret) {
        result.overrides.phone.accessKeySecret = encrypt(result.overrides.phone.accessKeySecret);
    }
    if ((_e = (_d = result.overrides) === null || _d === void 0 ? void 0 : _d.alipay) === null || _e === void 0 ? void 0 : _e.privateKey) {
        result.overrides.alipay.privateKey = encrypt(result.overrides.alipay.privateKey);
    }
    if ((_f = result.overrides) === null || _f === void 0 ? void 0 : _f.douyin) {
        const d = result.overrides.douyin;
        if (d.appSecret)
            d.appSecret = encrypt(d.appSecret);
        if (d.miniProgramAppSecret)
            d.miniProgramAppSecret = encrypt(d.miniProgramAppSecret);
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) {
            if (p.clientSecret)
                p.clientSecret = encrypt(p.clientSecret);
        }
    }
    return result;
}
/** 解密 domain 形状 authConfig 中所有敏感字段 */
function decryptAuthConfig(config) {
    var _a, _b, _c, _d, _e, _f;
    if (!config)
        return config;
    const result = JSON.parse(JSON.stringify(config));
    if ((_a = result.overrides) === null || _a === void 0 ? void 0 : _a.wechat) {
        const w = result.overrides.wechat;
        if (w.appSecret)
            w.appSecret = decrypt(w.appSecret);
        if (w.miniProgramAppSecret)
            w.miniProgramAppSecret = decrypt(w.miniProgramAppSecret);
        if (w.encodingAESKey)
            w.encodingAESKey = decrypt(w.encodingAESKey);
    }
    if ((_c = (_b = result.overrides) === null || _b === void 0 ? void 0 : _b.phone) === null || _c === void 0 ? void 0 : _c.accessKeySecret) {
        result.overrides.phone.accessKeySecret = decrypt(result.overrides.phone.accessKeySecret);
    }
    if ((_e = (_d = result.overrides) === null || _d === void 0 ? void 0 : _d.alipay) === null || _e === void 0 ? void 0 : _e.privateKey) {
        result.overrides.alipay.privateKey = decrypt(result.overrides.alipay.privateKey);
    }
    if ((_f = result.overrides) === null || _f === void 0 ? void 0 : _f.douyin) {
        const d = result.overrides.douyin;
        if (d.appSecret)
            d.appSecret = decrypt(d.appSecret);
        if (d.miniProgramAppSecret)
            d.miniProgramAppSecret = decrypt(d.miniProgramAppSecret);
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders) {
            if (p.clientSecret)
                p.clientSecret = decrypt(p.clientSecret);
        }
    }
    return result;
}
/** 脱敏 authConfig（管理后台读取用，secret 返回 ***） */
function maskAuthConfig(config) {
    var _a, _b, _c, _d;
    if (!config)
        return config;
    const result = JSON.parse(JSON.stringify(config));
    const maskField = (obj, field) => {
        if (obj === null || obj === void 0 ? void 0 : obj[field])
            obj[field] = '***';
    };
    if ((_a = result.overrides) === null || _a === void 0 ? void 0 : _a.wechat) {
        maskField(result.overrides.wechat, 'appSecret');
        maskField(result.overrides.wechat, 'miniProgramAppSecret');
        maskField(result.overrides.wechat, 'encodingAESKey');
    }
    if ((_b = result.overrides) === null || _b === void 0 ? void 0 : _b.phone)
        maskField(result.overrides.phone, 'accessKeySecret');
    if ((_c = result.overrides) === null || _c === void 0 ? void 0 : _c.alipay)
        maskField(result.overrides.alipay, 'privateKey');
    if ((_d = result.overrides) === null || _d === void 0 ? void 0 : _d.douyin) {
        maskField(result.overrides.douyin, 'appSecret');
        maskField(result.overrides.douyin, 'miniProgramAppSecret');
    }
    if (result.ssoProviders) {
        for (const p of result.ssoProviders)
            maskField(p, 'clientSecret');
    }
    return result;
}
/** 合并保存：新值中 *** 表示保留原值，最终结果为加密后的 domain 形状 */
function mergeAuthConfig(original, incoming) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    if (!original)
        return encryptAuthConfig(incoming);
    if (!incoming)
        return original;
    const result = JSON.parse(JSON.stringify(incoming));
    const mergeField = (origObj, newObj, field) => {
        if ((newObj === null || newObj === void 0 ? void 0 : newObj[field]) === '***' && (origObj === null || origObj === void 0 ? void 0 : origObj[field])) {
            newObj[field] = origObj[field]; // 保留原加密值
        }
    };
    if ((_a = result.overrides) === null || _a === void 0 ? void 0 : _a.wechat) {
        mergeField((_b = original.overrides) === null || _b === void 0 ? void 0 : _b.wechat, result.overrides.wechat, 'appSecret');
        mergeField((_c = original.overrides) === null || _c === void 0 ? void 0 : _c.wechat, result.overrides.wechat, 'miniProgramAppSecret');
        mergeField((_d = original.overrides) === null || _d === void 0 ? void 0 : _d.wechat, result.overrides.wechat, 'encodingAESKey');
    }
    if ((_e = result.overrides) === null || _e === void 0 ? void 0 : _e.phone)
        mergeField((_f = original.overrides) === null || _f === void 0 ? void 0 : _f.phone, result.overrides.phone, 'accessKeySecret');
    if ((_g = result.overrides) === null || _g === void 0 ? void 0 : _g.alipay)
        mergeField((_h = original.overrides) === null || _h === void 0 ? void 0 : _h.alipay, result.overrides.alipay, 'privateKey');
    if ((_j = result.overrides) === null || _j === void 0 ? void 0 : _j.douyin) {
        mergeField((_k = original.overrides) === null || _k === void 0 ? void 0 : _k.douyin, result.overrides.douyin, 'appSecret');
        mergeField((_l = original.overrides) === null || _l === void 0 ? void 0 : _l.douyin, result.overrides.douyin, 'miniProgramAppSecret');
    }
    if (result.ssoProviders && original.ssoProviders) {
        for (const newP of result.ssoProviders) {
            const origP = original.ssoProviders.find((p) => p.providerKey === newP.providerKey);
            mergeField(origP, newP, 'clientSecret');
        }
    }
    return encryptAuthConfig(result);
}
/**
 * 把 struct 原始值（{ enabledMethods, overridesJson, ssoProvidersJson }）解析+解密为 domain 配置。
 * 不依赖 ctx，纯函数，可用于任意来源的 struct 数据。
 */
function parseAndDecryptStruct(rawStruct) {
    if (!rawStruct)
        return null;
    const domain = { enabledMethods: rawStruct.enabledMethods || [] };
    if (rawStruct.overridesJson) {
        try {
            domain.overrides = JSON.parse(rawStruct.overridesJson);
        }
        catch (_a) {
            domain.overrides = {};
        }
    }
    if (rawStruct.ssoProvidersJson) {
        try {
            domain.ssoProviders = JSON.parse(rawStruct.ssoProvidersJson);
        }
        catch (_b) {
            domain.ssoProviders = [];
        }
    }
    return decryptAuthConfig(domain);
}
/** 把 struct 原始值解析+解密为 domain 配置；无配置返回 null。策略/resolver 读取的统一入口 */
function readChannelAuthConfig(ctx) {
    var _a, _b;
    const raw = (_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.authConfig;
    return parseAndDecryptStruct(raw);
}
/** 策略用：取某方式的已解密凭证覆盖，无则 null */
function getAuthOverride(ctx, method) {
    var _a;
    const config = readChannelAuthConfig(ctx);
    return ((_a = config === null || config === void 0 ? void 0 : config.overrides) === null || _a === void 0 ? void 0 : _a[method]) || null;
}
/** 把 domain 配置加密+序列化为 struct 形状（供写入 customFields.authConfig） */
function serializeAuthConfigToStruct(domain) {
    if (!domain)
        return null;
    const encrypted = encryptAuthConfig(domain);
    return {
        enabledMethods: encrypted.enabledMethods || [],
        overridesJson: encrypted.overrides ? JSON.stringify(encrypted.overrides) : '',
        ssoProvidersJson: encrypted.ssoProviders ? JSON.stringify(encrypted.ssoProviders) : '',
    };
}
//# sourceMappingURL=crypto.js.map