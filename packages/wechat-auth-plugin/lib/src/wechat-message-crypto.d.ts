export interface EncryptedMessage {
    encrypt: string;
    nonce: string;
    timestamp: string;
    msg_signature: string;
}
export declare function encryptMessage(token: string, encodingAESKey: string, appId: string, plain: string): EncryptedMessage;
export declare function decryptMessage(token: string, encodingAESKey: string, appId: string, encrypted: string): string;
export declare function verifySignature(token: string, timestamp: string, nonce: string, signature: string, encrypted: string): boolean;
