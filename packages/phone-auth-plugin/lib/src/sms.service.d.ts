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
    /** 验证码存储：phoneNumber → code（含失败次数） */
    private codeStore;
    /** 发码冷却：phoneNumber → 上次发码时间戳 */
    private sendCooldowns;
    /** 每日计数：`${phoneNumber}:${yyyyMMdd}` → 当日已发条数 */
    private dailyCounts;
    /** 按凭证指纹缓存的阿里云客户端（支持租户级凭证覆盖） */
    private clients;
    private devBypass;
    private devBypassCode;
    constructor(options: PhoneAuthPluginOptions);
    /** 判定能否立即发码；返回 null 表示放行，否则返回拒绝原因（供日志） */
    checkRateLimit(phoneNumber: string): string | null;
    sendVerificationCode(phoneNumber: string, credentials?: SmsCredentials): Promise<boolean>;
    verifyCode(phoneNumber: string, code: string): boolean;
    /** devBypass 透传（registerCustomer 等调用方需要知道验证流程是否在旁路模式） */
    isDevBypass(): boolean;
    private getClient;
    private generateCode;
    /** 本地时区当日键（如 20261012） */
    private dayKey;
    /** 惰性清理：该号的过期验证码/冷却记录 + 全局过载兜底清扫 */
    private sweepExpired;
}
