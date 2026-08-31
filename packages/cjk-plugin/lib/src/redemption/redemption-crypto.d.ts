export interface RedemptionKeyInput {
    key: string;
}
export declare function generateRedemptionCode(): string;
export declare function validChars(code: string): boolean;
export declare function encryptRedemptionCode(code: string, keyHex: string): {
    cipher: string;
    iv: string;
};
export declare function decryptRedemptionCode(cipherB64: string, ivB64: string, keyHex: string): string;
export declare function redemptionFingerprint(code: string, keyHex: string, channelSalt: string): string;
/** 管理端 Code128 一维条码载荷：可被门店一维扫码枪读取（复用商品条码扫码设备） */
export declare function redemptionBarcodePayload(orderCode: string, redemptionCode: string): string;
/** C 端二维码载荷：签名（nsQ #ts，服务端验签用） */
export declare function redemptionQrPayload(orderCode: string, code: string, keyHex: string): string;
export declare function verifyRedemptionQr(payloadStr: string, keyHex: string, maxAgeMs?: number): boolean;
