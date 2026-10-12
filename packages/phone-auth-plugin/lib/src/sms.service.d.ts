import { PhoneAuthPluginOptions } from './types';
/** 单次发码使用的有效凭证（全局 options 或租户覆盖解析结果） */
export interface SmsCredentials {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
}
export interface StoredCode {
    code: string;
    expiresAt: number;
    failures: number;
}
export declare class SmsService {
    private signName;
    private templateCode;
    private codeLength;
    private codeExpirySeconds;
    private store;
    private inMemoryStore;
    /** 按凭证指纹缓存的阿里云客户端（支持租户级凭证覆盖） */
    private clients;
    private devBypass;
    private devBypassCode;
    constructor(options: PhoneAuthPluginOptions);
    /** 判定能否立即发码；返回 null 表示放行，否则返回拒绝原因（供日志） */
    checkRateLimit(phoneNumber: string): Promise<string | null>;
    sendVerificationCode(phoneNumber: string, credentials?: SmsCredentials): Promise<boolean>;
    verifyCode(phoneNumber: string, code: string): Promise<boolean>;
    /** devBypass 透传（registerCustomer 等调用方需要知道验证流程是否在旁路模式） */
    isDevBypass(): boolean;
    private getClient;
    private generateCode;
}
