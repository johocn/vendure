import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import Dysmsapi, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import OpenApiClient, { Config } from '@alicloud/openapi-client';
import { Logger } from '@vendure/core';

import { loggerCtx } from './constants';
import { PhoneAuthPluginOptions } from './types';

/** 单次发码使用的有效凭证（全局 options 或租户覆盖解析结果） */
export interface SmsCredentials {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
}

const SEND_COOLDOWN_MS = 60_000; // 同号发码冷却
const DAILY_SEND_LIMIT = 10; // 同号每日发码上限
const MAX_VERIFY_FAILURES = 5; // 同一验证码连续失败 N 次后作废

export interface StoredCode {
    code: string;
    expiresAt: number;
    failures: number;
}

@Injectable()
export class SmsService {
    private signName: string;
    private templateCode: string;
    private codeLength: number;
    private codeExpirySeconds: number;

    /** 验证码存储：phoneNumber → code（含失败次数） */
    private codeStore: Map<string, StoredCode>;
    /** 发码冷却：phoneNumber → 上次发码时间戳 */
    private sendCooldowns: Map<string, number>;
    /** 每日计数：`${phoneNumber}:${yyyyMMdd}` → 当日已发条数 */
    private dailyCounts: Map<string, number>;
    /** 按凭证指纹缓存的阿里云客户端（支持租户级凭证覆盖） */
    private clients: Map<string, Dysmsapi>;

    private devBypass: boolean;
    private devBypassCode: string;

    constructor(options: PhoneAuthPluginOptions) {
        this.signName = options.signName;
        this.templateCode = options.templateCode;
        this.codeLength = options.codeLength || 6;
        this.codeExpirySeconds = options.codeExpirySeconds || 300;
        this.codeStore = new Map();
        this.sendCooldowns = new Map();
        this.dailyCounts = new Map();
        this.clients = new Map();
        // 生产环境强制关闭 devBypass 后门（防环境变量误配导致任意手机号接管账号）
        this.devBypass = options.devBypass || false;
        if (this.devBypass && process.env.NODE_ENV === 'production') {
            Logger.warn('devBypass is ignored in production', loggerCtx);
            this.devBypass = false;
        }
        this.devBypassCode = options.devBypassCode || '123456';
    }

    /** 判定能否立即发码；返回 null 表示放行，否则返回拒绝原因（供日志） */
    checkRateLimit(phoneNumber: string): string | null {
        this.sweepExpired(phoneNumber);
        const last = this.sendCooldowns.get(phoneNumber);
        if (last && Date.now() - last < SEND_COOLDOWN_MS) {
            return 'cooldown';
        }
        const dayKey = `${phoneNumber}:${this.dayKey()}`;
        if ((this.dailyCounts.get(dayKey) || 0) >= DAILY_SEND_LIMIT) {
            return 'daily-limit';
        }
        return null;
    }

    async sendVerificationCode(phoneNumber: string, credentials?: SmsCredentials): Promise<boolean> {
        const code = this.generateCode();
        this.codeStore.set(phoneNumber, {
            code,
            expiresAt: Date.now() + this.codeExpirySeconds * 1000,
            failures: 0,
        });
        this.sendCooldowns.set(phoneNumber, Date.now());
        const dayKey = `${phoneNumber}:${this.dayKey()}`;
        this.dailyCounts.set(dayKey, (this.dailyCounts.get(dayKey) || 0) + 1);

        if (this.devBypass) {
            Logger.info(`[DEV BYPASS] Verification code for ${phoneNumber}: ${code}`, loggerCtx);
            return true;
        }

        const creds = credentials || {
            accessKeyId: '',
            accessKeySecret: '',
            signName: this.signName,
            templateCode: this.templateCode,
        };
        // 兜底凭证缺失（未配置短信/租户覆盖也不完整）时，验证码仅存内存不发真实短信
        if (!creds.accessKeyId || !creds.accessKeySecret) {
            Logger.warn(`SMS credentials missing, code stored without sending (${phoneNumber})`, loggerCtx);
            return false;
        }

        try {
            const client = this.getClient(creds);
            const request = new SendSmsRequest({
                phoneNumbers: phoneNumber,
                signName: creds.signName,
                templateCode: creds.templateCode,
                templateParam: JSON.stringify({ code }),
            });
            const result = await client.sendSms(request);

            if (result.body?.code === 'OK') {
                Logger.info(`SMS sent to ${phoneNumber}`, loggerCtx);
                return true;
            }

            Logger.error(`SMS send failed: ${result.body?.message}`, loggerCtx);
            return false;
        } catch (e: any) {
            Logger.error(`SMS send error: ${e.message}`, loggerCtx);
            return false;
        }
    }

    verifyCode(phoneNumber: string, code: string): boolean {
        const stored = this.codeStore.get(phoneNumber);
        if (!stored) return false;
        if (Date.now() > stored.expiresAt) {
            this.codeStore.delete(phoneNumber);
            return false;
        }
        // 连续失败超过阈值则作废当前验证码（防 6 位码暴力枚举），需重新发码
        if (stored.code === code) {
            this.codeStore.delete(phoneNumber);
            return true;
        }
        stored.failures += 1;
        if (stored.failures >= MAX_VERIFY_FAILURES) {
            this.codeStore.delete(phoneNumber);
            Logger.warn(`Verification code invalidated after ${stored.failures} failures (${phoneNumber})`, loggerCtx);
            return false;
        }
        if (this.devBypass && code === this.devBypassCode) {
            this.codeStore.delete(phoneNumber);
            Logger.info(`[DEV BYPASS] Accepted bypass code for ${phoneNumber}`, loggerCtx);
            return true;
        }
        return false;
    }

    /** devBypass 透传（registerCustomer 等调用方需要知道验证流程是否在旁路模式） */
    isDevBypass(): boolean {
        return this.devBypass;
    }

    private getClient(creds: SmsCredentials): Dysmsapi {
        const fingerprint = `${creds.accessKeyId}:${creds.accessKeySecret}`;
        let client = this.clients.get(fingerprint);
        if (!client) {
            client = new Dysmsapi(
                new Config({
                    accessKeyId: creds.accessKeyId,
                    accessKeySecret: creds.accessKeySecret,
                    endpoint: 'dysmsapi.aliyuncs.com',
                }),
            );
            this.clients.set(fingerprint, client);
        }
        return client;
    }

    private generateCode(): string {
        let code = '';
        for (let i = 0; i < this.codeLength; i++) {
            code += String(randomInt(0, 10));
        }
        return code;
    }

    /** 本地时区当日键（如 20261012） */
    private dayKey(): string {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    /** 惰性清理：该号的过期验证码/冷却记录 + 全局过载兜底清扫 */
    private sweepExpired(phoneNumber?: string): void {
        if (phoneNumber && this.codeStore.has(phoneNumber)) {
            const stored = this.codeStore.get(phoneNumber)!;
            if (Date.now() > stored.expiresAt) this.codeStore.delete(phoneNumber);
        }
        if (this.codeStore.size > 10_000) {
            const now = Date.now();
            for (const [k, v] of this.codeStore) {
                if (now > v.expiresAt) this.codeStore.delete(k);
            }
        }
        if (this.sendCooldowns.size > 10_000) {
            const now = Date.now();
            for (const [k, t] of this.sendCooldowns) {
                if (now - t >= SEND_COOLDOWN_MS) this.sendCooldowns.delete(k);
            }
        }
        if (this.dailyCounts.size > 50_000) {
            const today = this.dayKey();
            for (const k of this.dailyCounts.keys()) {
                if (!k.endsWith(`:${today}`)) this.dailyCounts.delete(k);
            }
        }
    }
}
