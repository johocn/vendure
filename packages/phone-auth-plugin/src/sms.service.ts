import { Injectable } from '@nestjs/common';
import Dysmsapi, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import OpenApiClient, { Config } from '@alicloud/openapi-client';
import { Logger } from '@vendure/core';

import { loggerCtx } from './constants';
import { PhoneAuthPluginOptions } from './types';

@Injectable()
export class SmsService {
    private client: Dysmsapi;
    private signName: string;
    private templateCode: string;
    private codeLength: number;
    private codeExpirySeconds: number;
    private codeStore: Map<string, { code: string; expiresAt: number }>;

    constructor(options: PhoneAuthPluginOptions) {
        const config = new Config({
            accessKeyId: options.accessKeyId,
            accessKeySecret: options.accessKeySecret,
            endpoint: 'dysmsapi.aliyuncs.com',
        });
        this.client = new Dysmsapi(config);
        this.signName = options.signName;
        this.templateCode = options.templateCode;
        this.codeLength = options.codeLength || 6;
        this.codeExpirySeconds = options.codeExpirySeconds || 300;
        this.codeStore = new Map();
    }

    async sendVerificationCode(phoneNumber: string): Promise<boolean> {
        const code = this.generateCode();
        this.codeStore.set(phoneNumber, {
            code,
            expiresAt: Date.now() + this.codeExpirySeconds * 1000,
        });

        try {
            const request = new SendSmsRequest({
                phoneNumbers: phoneNumber,
                signName: this.signName,
                templateCode: this.templateCode,
                templateParam: JSON.stringify({ code }),
            });
            const result = await this.client.sendSms(request);

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
        if (stored.code === code) {
            this.codeStore.delete(phoneNumber);
            return true;
        }
        return false;
    }

    private generateCode(): string {
        const digits = '0123456789';
        let code = '';
        for (let i = 0; i < this.codeLength; i++) {
            code += digits[Math.floor(Math.random() * 10)];
        }
        return code;
    }
}
