import * as crypto from 'crypto';

export interface EncryptedMessage {
    encrypt: string;
    nonce: string;
    timestamp: string;
    msg_signature: string;
}

function aesKeyFromEncoding(encodingAESKey: string): Buffer {
    if (encodingAESKey.length !== 43) throw new Error('AES key must be 43 chars');
    return Buffer.from(encodingAESKey + '=', 'base64');
}

function sha1(...parts: string[]): string {
    return crypto.createHash('sha1').update(parts.sort().join('')).digest('hex');
}

export function encryptMessage(token: string, encodingAESKey: string, appId: string, plain: string): EncryptedMessage {
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

export function decryptMessage(token: string, encodingAESKey: string, appId: string, encrypted: string): string {
    const aesKey = aesKeyFromEncoding(encodingAESKey);
    const iv = aesKey.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]);
    // 跳过 16 字节随机串,读 4 字节长度,取消息,剩余为 appId
    const msgLen = decrypted.readUInt32BE(16);
    const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');
    const receivedAppId = decrypted.slice(20 + msgLen).toString('utf8');
    if (receivedAppId !== appId) throw new Error(`AppId mismatch: ${receivedAppId} vs ${appId}`);
    return msg;
}

export function verifySignature(token: string, timestamp: string, nonce: string, signature: string, encrypted: string): boolean {
    const expected = sha1(token, timestamp, nonce, encrypted);
    return expected === signature;
}
