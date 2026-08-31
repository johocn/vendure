import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// 6 位大写字母+数字，去掉易混 O/I/0/1。校验位 = 前 5 位映射和 mod(31) 对应的字符，避免误输。
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 32 chars
const CODE_LEN = 6;

export interface RedemptionKeyInput {
    key: string; // 用于 AES + HMAC 的 32 字节十六进制串（64 hex chars）
}

export function generateRedemptionCode(): string {
    const body = Array.from({ length: CODE_LEN - 1 }, () =>
        CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join('');
    let sum = 0;
    for (const ch of body) sum += CODE_CHARS.indexOf(ch);
    const check = CODE_CHARS[sum % CODE_CHARS.length];
    return (body + check).toUpperCase();
}

export function validChars(code: string): boolean {
    if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code)) return false;
    const body = code.slice(0, 5);
    let sum = 0;
    for (const ch of body) sum += CODE_CHARS.indexOf(ch);
    return CODE_CHARS[sum % CODE_CHARS.length] === code[5];
}

export function encryptRedemptionCode(code: string, keyHex: string): { cipher: string; iv: string } {
    const key = Buffer.from(keyHex, 'hex');
    const iv = randomBytes(12); // GCM 12B nonce
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        cipher: Buffer.concat([enc, tag]).toString('base64'),
        iv: iv.toString('base64'),
    };
}

export function decryptRedemptionCode(cipherB64: string, ivB64: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivB64, 'base64');
    const data = Buffer.from(cipherB64, 'base64');
    const tag = data.subarray(data.length - 16);
    const enc = data.subarray(0, data.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function redemptionFingerprint(code: string, keyHex: string, channelSalt: string): string {
    return createHmac('sha256', `${keyHex}:${channelSalt}`).update(code.toUpperCase()).digest('hex');
}

/** 管理端 Code128 一维条码载荷：可被门店一维扫码枪读取（复用商品条码扫码设备） */
export function redemptionBarcodePayload(orderCode: string, redemptionCode: string): string {
    return `RD:${orderCode}:${redemptionCode.toUpperCase()}`;
}

/** C 端二维码载荷：签名（nsQ #ts，服务端验签用） */
export function redemptionQrPayload(orderCode: string, code: string, keyHex: string): string {
    const ts = Date.now();
    const sig = createHmac('sha256', keyHex).update(`${orderCode}:${code}:${ts}`).digest('hex').slice(0, 16);
    return JSON.stringify({ o: orderCode, c: code, ts, s: sig });
}

export function verifyRedemptionQr(payloadStr: string, keyHex: string, maxAgeMs = 5 * 60_000): boolean {
    try {
        const p = JSON.parse(payloadStr);
        if (typeof p.o !== 'string' || typeof p.c !== 'string' || typeof p.ts !== 'number' || typeof p.s !== 'string') return false;
        if (Date.now() - p.ts > maxAgeMs) return false;
        const sig = createHmac('sha256', keyHex).update(`${p.o}:${p.c}:${p.ts}`).digest('hex').slice(0, 16);
        return sig === p.s && validChars(p.c);
    } catch {
        return false;
    }
}