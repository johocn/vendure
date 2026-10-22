"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalString = canonicalString;
exports.buildMeituanSign = buildMeituanSign;
exports.buildMeituanParams = buildMeituanParams;
exports.verifyMeituanCallback = verifyMeituanCallback;
const crypto_1 = require("crypto");
/** 参与签名的标量字段（剔除 sign / 空值 / 对象），键名升序拼成 k=v&... */
function canonicalString(params) {
    return Object.keys(params)
        .filter(k => k !== 'sign')
        .filter(k => {
        const v = params[k];
        return v !== undefined && v !== null && v !== '' && typeof v !== 'object';
    })
        .sort()
        .map(k => `${k}=${String(params[k])}`)
        .join('&');
}
function md5(input) {
    return (0, crypto_1.createHash)('md5').update(input, 'utf8').digest('hex');
}
/**
 * 计算美团签名。
 * - legacy：MD5(appkey + timestamp + version + appSecret)
 * - open：MD5(`${apiUrl}?${canonicalString(params)}&appSecret=${appSecret}`)
 */
function buildMeituanSign(params, appSecret, mode, apiUrl = '') {
    if (mode === 'legacy') {
        return md5(`${params.appkey}${params.timestamp}${params.version}${appSecret}`);
    }
    if (!apiUrl) {
        throw new Error('meituan open 签名模式必须提供 apiUrl');
    }
    return md5(`${apiUrl}?${canonicalString(params)}&appSecret=${appSecret}`);
}
/** 构造请求参数（body 为业务对象，序列化后参与签名；旧版接口 body 不参与） */
function buildMeituanParams(appKey, appSecret, mode, body, timestamp = Math.floor(Date.now() / 1000), apiUrl = '') {
    const params = {
        appkey: appKey,
        timestamp: String(timestamp),
        version: '1.0',
        body: JSON.stringify(body),
    };
    const signSource = mode === 'legacy' ? { appkey: params.appkey, timestamp: params.timestamp, version: params.version } : params;
    return Object.assign(Object.assign({}, params), { sign: buildMeituanSign(signSource, appSecret, mode, apiUrl) });
}
/** 回调验签：按同一规则重算，签名必须一致；任何异常都返回 false（不得抛出，否则 webhook 会 500） */
function verifyMeituanCallback(payload, appSecret, mode, apiUrl = '') {
    const sign = typeof payload.sign === 'string' ? payload.sign : '';
    if (!sign)
        return false;
    const { sign: _ignored } = payload, rest = __rest(payload, ["sign"]);
    try {
        return buildMeituanSign(rest, appSecret, mode, apiUrl) === sign;
    }
    catch (_a) {
        return false;
    }
}
//# sourceMappingURL=meituan-signature.js.map