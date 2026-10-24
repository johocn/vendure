"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptFeishuPayload = decryptFeishuPayload;
exports.feishuSignature = feishuSignature;
const crypto_1 = require("crypto");
/**
 * 飞书事件订阅加密解密：AES-256-CBC。
 * key = sha256(encryptKey)，iv = 密文前 16 字节；明文为 UTF-8 JSON 字符串。
 * 解密失败返回 null（调用方按无效请求处理），不抛错。
 */
function decryptFeishuPayload(encrypt, encryptKey) {
    if (!encrypt || !encryptKey)
        return null;
    try {
        const key = (0, crypto_1.createHash)('sha256').update(encryptKey).digest();
        const data = Buffer.from(encrypt, 'base64');
        if (data.length <= 16)
            return null;
        const iv = data.subarray(0, 16);
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-cbc', key, iv);
        const plain = Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]).toString('utf8');
        return JSON.parse(plain);
    }
    catch (_a) {
        return null;
    }
}
/** 飞书回调签名：sha256(timestamp + nonce + encryptKey + rawBody)，rawBody 拿不到时用 JSON.stringify(body) */
function feishuSignature(timestamp, nonce, encryptKey, rawBody) {
    return (0, crypto_1.createHash)('sha256').update(`${timestamp}${nonce}${encryptKey}${rawBody}`).digest('hex');
}
//# sourceMappingURL=feishu.crypto.js.map