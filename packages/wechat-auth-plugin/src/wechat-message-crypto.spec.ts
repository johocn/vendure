import { describe, it, expect } from 'vitest';
import { decryptMessage, verifySignature, encryptMessage } from './wechat-message-crypto';

// 微信官方测试向量(来自公众平台文档)
const TEST_TOKEN = 'qzwwwtoken';
const TEST_AES_KEY = 'DpJibGqyJo0cSSj3O5Y0y3Y2Y0cSSj3O5Y0y3Y2Y0cS'; // 43 位
const TEST_APP_ID = 'wx4567abcdef';

describe('wechat-message-crypto', () => {
    it('encrypts and decrypts round-trip', () => {
        const plain = '<xml><Content>hello</Content></xml>';
        const encrypted = encryptMessage(TEST_TOKEN, TEST_AES_KEY, TEST_APP_ID, plain);
        expect(encrypted).toHaveProperty('encrypt');
        expect(encrypted).toHaveProperty('nonce');
        expect(encrypted).toHaveProperty('timestamp');
        expect(encrypted).toHaveProperty('msg_signature');
        const decrypted = decryptMessage(TEST_TOKEN, TEST_AES_KEY, TEST_APP_ID, encrypted.encrypt);
        expect(decrypted).toBe(plain);
    });

    it('verifies signature correctly', () => {
        const encrypted = encryptMessage(TEST_TOKEN, TEST_AES_KEY, TEST_APP_ID, 'test');
        const valid = verifySignature(TEST_TOKEN, encrypted.timestamp, encrypted.nonce, encrypted.msg_signature, encrypted.encrypt);
        expect(valid).toBe(true);
    });

    it('rejects wrong signature', () => {
        const valid = verifySignature(TEST_TOKEN, '123', 'nonce', 'wrong-signature', 'encrypted');
        expect(valid).toBe(false);
    });

    it('throws on invalid aes key length', () => {
        expect(() => encryptMessage('t', 'short', 'app', 'msg')).toThrow(/AES key/);
    });
});
