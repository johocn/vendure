"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildParamString = buildParamString;
exports.sign = sign;
exports.buildSignedParams = buildSignedParams;
exports.verifyCallbackSignature = verifyCallbackSignature;
const crypto_1 = require("crypto");
/**
 * 达达开放平台签名（官方新开放平台直连样式，非 key=value& 拼接）。
 * 规则：除 signature 外的参数按 key ASCII 升序，拼接 key1value1key2value2...
 * signature = MD5(app_secret + 拼接串 + app_secret).toUpperCase()
 */
/** 升序拼接出参数字符串（排除 signature 自身） */
function buildParamString(params) {
    return Object.keys(params)
        .filter(k => k !== 'signature')
        .sort()
        .map(k => `${k}${params[k]}`)
        .join('');
}
/** 计算签名：MD5(app_secret + paramString + app_secret)，转大写 */
function sign(appSecret, paramString) {
    return (0, crypto_1.createHash)('md5')
        .update(`${appSecret}${paramString}${appSecret}`, 'utf8')
        .digest('hex')
        .toUpperCase();
}
/** 生成带签名的达达出站请求参数（body 为业务参数对象，序列化为 JSON 字符串） */
function buildSignedParams(appKey, appSecret, body, options) {
    var _a;
    const params = {
        app_key: appKey,
        body: JSON.stringify(body),
        format: 'json',
        timestamp: String((_a = options === null || options === void 0 ? void 0 : options.timestamp) !== null && _a !== void 0 ? _a : Math.floor(Date.now() / 1000)),
        v: '1.0',
    };
    if (options === null || options === void 0 ? void 0 : options.sourceId) {
        params.source_id = options.sourceId;
    }
    const signature = sign(appSecret, buildParamString(params));
    return Object.assign(Object.assign({ app_key: params.app_key, body: params.body, format: params.format, timestamp: params.timestamp, v: params.v }, (params.source_id ? { source_id: params.source_id } : {})), { signature });
}
/**
 * 校验达达回调签名。
 * 报文为平铺 JSON（app_key/body/format/timestamp/v/source_id/.../signature），
 * 用与出站相同的直连拼接规则，对除 signature 外全部字段验签。
 */
function verifyCallbackSignature(payload, appSecret) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    const record = payload;
    const signature = record.signature;
    if (typeof signature !== 'string' || !signature) {
        return false;
    }
    const fields = {};
    for (const [k, v] of Object.entries(record)) {
        if (k === 'signature') {
            continue;
        }
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            fields[k] = String(v);
        }
    }
    return sign(appSecret, buildParamString(fields)) === signature.toUpperCase();
}
//# sourceMappingURL=dada-signature.js.map