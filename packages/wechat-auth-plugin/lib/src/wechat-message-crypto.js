"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptMessage = encryptMessage;
exports.decryptMessage = decryptMessage;
exports.verifySignature = verifySignature;
const crypto = __importStar(require("crypto"));
function aesKeyFromEncoding(encodingAESKey) {
    if (encodingAESKey.length !== 43)
        throw new Error('AES key must be 43 chars');
    return Buffer.from(encodingAESKey + '=', 'base64');
}
function sha1(...parts) {
    return crypto.createHash('sha1').update(parts.sort().join('')).digest('hex');
}
function encryptMessage(token, encodingAESKey, appId, plain) {
    const aesKey = aesKeyFromEncoding(encodingAESKey);
    const iv = aesKey.slice(0, 16);
    const random = crypto.randomBytes(16);
    const msgBuf = Buffer.from(plain, 'utf8');
    const msgLen = Buffer.alloc(4);
    msgLen.writeUInt32BE(msgBuf.length, 0);
    const appBuf = Buffer.from(appId, 'utf8');
    const plainBuf = Buffer.concat([random, msgLen, msgBuf, appBuf]);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final()]).toString('base64');
    const nonce = Math.random().toString(36).slice(2);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const msg_signature = sha1(token, timestamp, nonce, encrypted);
    return { encrypt: encrypted, nonce, timestamp, msg_signature };
}
function decryptMessage(token, encodingAESKey, appId, encrypted) {
    const aesKey = aesKeyFromEncoding(encodingAESKey);
    const iv = aesKey.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]);
    // 跳过 16 字节随机串,读 4 字节长度,取消息,剩余为 appId
    const msgLen = decrypted.readUInt32BE(16);
    const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');
    const receivedAppId = decrypted.slice(20 + msgLen).toString('utf8');
    if (receivedAppId !== appId)
        throw new Error(`AppId mismatch: ${receivedAppId} vs ${appId}`);
    return msg;
}
function verifySignature(token, timestamp, nonce, signature, encrypted) {
    const expected = sha1(token, timestamp, nonce, encrypted);
    return expected === signature;
}
//# sourceMappingURL=wechat-message-crypto.js.map