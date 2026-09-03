"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRedemptionCode = generateRedemptionCode;
exports.validChars = validChars;
exports.encryptRedemptionCode = encryptRedemptionCode;
exports.decryptRedemptionCode = decryptRedemptionCode;
exports.redemptionFingerprint = redemptionFingerprint;
exports.redemptionBarcodePayload = redemptionBarcodePayload;
exports.redemptionQrPayload = redemptionQrPayload;
exports.verifyRedemptionQr = verifyRedemptionQr;
exports.computeRedemptionStatus = computeRedemptionStatus;
const node_crypto_1 = require("node:crypto");
// 6 位大写字母+数字，去掉易混 O/I/0/1。校验位 = 前 5 位映射和 mod(31) 对应的字符，避免误输。
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 32 chars
const CODE_LEN = 6;
function generateRedemptionCode() {
    const body = Array.from({ length: CODE_LEN - 1 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    let sum = 0;
    for (const ch of body)
        sum += CODE_CHARS.indexOf(ch);
    const check = CODE_CHARS[sum % CODE_CHARS.length];
    return (body + check).toUpperCase();
}
function validChars(code) {
    if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code))
        return false;
    const body = code.slice(0, 5);
    let sum = 0;
    for (const ch of body)
        sum += CODE_CHARS.indexOf(ch);
    return CODE_CHARS[sum % CODE_CHARS.length] === code[5];
}
function encryptRedemptionCode(code, keyHex) {
    const key = Buffer.from(keyHex, 'hex');
    const iv = (0, node_crypto_1.randomBytes)(12); // GCM 12B nonce
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        cipher: Buffer.concat([enc, tag]).toString('base64'),
        iv: iv.toString('base64'),
    };
}
function decryptRedemptionCode(cipherB64, ivB64, keyHex) {
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivB64, 'base64');
    const data = Buffer.from(cipherB64, 'base64');
    const tag = data.subarray(data.length - 16);
    const enc = data.subarray(0, data.length - 16);
    const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
function redemptionFingerprint(code, keyHex, channelSalt) {
    return (0, node_crypto_1.createHmac)('sha256', `${keyHex}:${channelSalt}`).update(code.toUpperCase()).digest('hex');
}
/** 管理端 Code128 一维条码载荷：可被门店一维扫码枪读取（复用商品条码扫码设备） */
function redemptionBarcodePayload(orderCode, redemptionCode) {
    return `RD:${orderCode}:${redemptionCode.toUpperCase()}`;
}
/** C 端二维码载荷：签名（nsQ #ts，服务端验签用） */
function redemptionQrPayload(orderCode, code, keyHex) {
    const ts = Date.now();
    const sig = (0, node_crypto_1.createHmac)('sha256', keyHex).update(`${orderCode}:${code}:${ts}`).digest('hex').slice(0, 16);
    return JSON.stringify({ o: orderCode, c: code, ts, s: sig });
}
function verifyRedemptionQr(payloadStr, keyHex, maxAgeMs = 5 * 60000) {
    try {
        const p = JSON.parse(payloadStr);
        if (typeof p.o !== 'string' || typeof p.c !== 'string' || typeof p.ts !== 'number' || typeof p.s !== 'string')
            return false;
        if (Date.now() - p.ts > maxAgeMs)
            return false;
        const sig = (0, node_crypto_1.createHmac)('sha256', keyHex).update(`${p.o}:${p.c}:${p.ts}`).digest('hex').slice(0, 16);
        return sig === p.s && validChars(p.c);
    }
    catch (_a) {
        return false;
    }
}
/** 状态推导为纯函数（服务/resolver 共用，TDD 友好）。阈值=剩余毫秒 <= remindHours 判断「即将过期」。 */
function computeRedemptionStatus(claimed, expiresAtIso, now, expireRemindHours) {
    if (claimed)
        return 'claimed';
    if (!expiresAtIso)
        return 'active';
    const expiresMs = new Date(expiresAtIso).getTime();
    if (now.getTime() >= expiresMs)
        return 'expired';
    const remainingMs = expiresMs - now.getTime();
    return remainingMs <= expireRemindHours * 3600000 ? 'expiring_soon' : 'active';
}
//# sourceMappingURL=redemption-crypto.js.map