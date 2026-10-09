import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { TCM_PLUGIN_OPTIONS, loggerCtx } from '../constants';
import { TcmClinicPluginOptions } from '../types';

@Injectable()
export class TcmCryptoService {
    private readonly key: Buffer;

    constructor(@Inject(TCM_PLUGIN_OPTIONS) options: TcmClinicPluginOptions) {
        const hex = options.encryptionKey ?? process.env.TCM_RECORD_KEY ?? '';
        if (/^[0-9a-fA-F]{64}$/.test(hex)) {
            this.key = Buffer.from(hex, 'hex');
        } else {
            // 仅限开发环境：无密钥时用固定开发密钥派生 32 字节并告警
            Logger.warn('TCM_RECORD_KEY 未配置，使用开发密钥（禁止用于生产）', loggerCtx);
            this.key = createHash('sha256').update('tcm-clinic-plugin-dev-key').digest();
        }
    }

    encrypt(plain: string): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`;
    }

    decrypt(payload: string): string {
        const [ivB64, tagB64, dataB64] = payload.split('.');
        if (!ivB64 || !tagB64 || !dataB64) {
            throw new Error('密文格式非法');
        }
        const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    }
}
