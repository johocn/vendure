"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPayConfig = encryptPayConfig;
exports.decryptPayConfig = decryptPayConfig;
exports.maskPayConfig = maskPayConfig;
exports.mergePayConfig = mergePayConfig;
const crypto_1 = require("../auth/crypto");
const ALIPAY_SECRETS = ['privateKey'];
const WECHATPAY_SECRETS = ['privateKey', 'apiKey'];
const DOUYINPAY_SECRETS = ['appSecret', 'privateKey'];
function encryptFields(obj, fields) {
    const out = Object.assign({}, obj);
    for (const f of fields) {
        const v = out[f];
        if (typeof v === 'string' && v && !(0, crypto_1.isEncrypted)(v))
            out[f] = (0, crypto_1.encrypt)(v);
    }
    return out;
}
function decryptFields(obj, fields) {
    const out = Object.assign({}, obj);
    for (const f of fields) {
        const v = out[f];
        if (typeof v === 'string' && v && (0, crypto_1.isEncrypted)(v))
            out[f] = (0, crypto_1.decrypt)(v);
    }
    return out;
}
function maskFields(obj, fields) {
    const out = Object.assign({}, obj);
    for (const f of fields) {
        if (typeof out[f] === 'string' && out[f])
            out[f] = '*******';
    }
    return out;
}
function mergeFields(original, patch) {
    if (!patch)
        return original;
    if (!original) {
        const out = {};
        for (const k of Object.keys(patch))
            out[k] = patch[k] === '***' ? '' : patch[k];
        return out;
    }
    const out = Object.assign({}, original);
    for (const k of Object.keys(patch)) {
        const v = patch[k];
        if (v === '***')
            continue;
        out[k] = v;
    }
    return out;
}
function encryptPayConfig(config) {
    if (!config)
        return null;
    const out = {};
    if (config.alipay)
        out.alipay = encryptFields(config.alipay, ALIPAY_SECRETS);
    if (config.wechatpay)
        out.wechatpay = encryptFields(config.wechatpay, WECHATPAY_SECRETS);
    if (config.douyinpay)
        out.douyinpay = encryptFields(config.douyinpay, DOUYINPAY_SECRETS);
    return out;
}
function decryptPayConfig(config) {
    if (!config)
        return null;
    const out = {};
    if (config.alipay)
        out.alipay = decryptFields(config.alipay, ALIPAY_SECRETS);
    if (config.wechatpay)
        out.wechatpay = decryptFields(config.wechatpay, WECHATPAY_SECRETS);
    if (config.douyinpay)
        out.douyinpay = decryptFields(config.douyinpay, DOUYINPAY_SECRETS);
    return out;
}
function maskPayConfig(config) {
    if (!config)
        return null;
    const out = {};
    if (config.alipay)
        out.alipay = maskFields(config.alipay, ALIPAY_SECRETS);
    if (config.wechatpay)
        out.wechatpay = maskFields(config.wechatpay, WECHATPAY_SECRETS);
    if (config.douyinpay)
        out.douyinpay = maskFields(config.douyinpay, DOUYINPAY_SECRETS);
    return out;
}
function mergePayConfig(original, patch) {
    if (!patch)
        return original;
    const base = original || {};
    return {
        alipay: mergeFields(base.alipay, patch.alipay),
        wechatpay: mergeFields(base.wechatpay, patch.wechatpay),
        douyinpay: mergeFields(base.douyinpay, patch.douyinpay),
    };
}
//# sourceMappingURL=pay-config-crypto.js.map