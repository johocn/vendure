import * as crypto from 'crypto';

const SECRET = process.env.DISTRIBUTION_ACCOUNT_SECRET || 'distribution-account-secret-dev';
const KEY = crypto.scryptSync(SECRET, 'salt', 32);

export function encryptAccount(plaintext: string): string {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptAccount(ciphertext: string): string {
    if (!ciphertext || !ciphertext.startsWith('enc:')) return ciphertext;
    const [, ivHex, tagHex, dataHex] = ciphertext.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
}
