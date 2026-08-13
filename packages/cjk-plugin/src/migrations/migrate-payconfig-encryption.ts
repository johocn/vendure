// packages/cjk-plugin/src/migrations/migrate-payconfig-encryption.ts
import { RequestContext, ChannelService } from '@vendure/core';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { encryptPayConfig } from '../payment/pay-config-crypto';
import { isEncrypted } from '../auth/crypto';
import type { AlipayCredentials, DouyinpayCredentials, PayConfig, PayConfigStruct, WechatpayCredentials } from '../payment/payment-config.types';

export const PAY_CONFIG_MIGRATION_DONE = 'PAY_CONFIG_MIGRATION_DONE';
const DISCRIMINATOR = 'tenant-config-migration';

@Injectable()
export class PayConfigEncryptionMigration implements OnApplicationBootstrap {
    constructor(
        @InjectConnection() private connection: Connection,
        private channelService: ChannelService,
    ) {}

    async onApplicationBootstrap() {
        const ctx = RequestContext.empty();
        const done = await this.connection
            .createQueryBuilder()
            .select('id')
            .from('history_entry', 'he')
            .where('he.type = :type', { type: PAY_CONFIG_MIGRATION_DONE })
            .getRawOne();
        if (done) return;

        const channels = await this.channelService.findAll(ctx);
        let migrated = 0;
        for (const channel of channels.items) {
            const raw = (channel as any).customFields?.payConfig as PayConfigStruct | undefined;
            if (!raw) continue;
            let changed = false;
            const newStruct: PayConfigStruct = { ...raw };
            for (const field of ['alipayJson', 'wechatpayJson', 'douyinpayJson'] as (keyof PayConfigStruct)[]) {
                const json = raw[field];
                if (!json) continue;
                try {
                    const parsed = JSON.parse(json);
                    // 简单检测:任一 secret 字段未加密则迁移
                    const needs = this.needsEncryption(parsed);
                    if (!needs) continue;
                    const encrypted = encryptPayConfig(parsed)!;
                    newStruct[field] = JSON.stringify(encrypted);
                    changed = true;
                } catch {}
            }
            if (changed) {
                await this.channelService.update(ctx, { id: channel.id as any, customFields: { payConfig: newStruct } });
                migrated++;
            }
        }
        // 用 query builder 直接插入(因 HistoryEntry 是 abstract 单表继承,不能 save 对象字面量)
        await this.connection
            .createQueryBuilder()
            .insert()
            .into('history_entry')
            .values({
                createdAt: new Date(),
                updatedAt: new Date(),
                type: PAY_CONFIG_MIGRATION_DONE,
                isPublic: false,
                data: JSON.stringify({ migrated }),
                discriminator: DISCRIMINATOR,
            })
            .execute();
    }

    private needsEncryption(config: PayConfig): boolean {
        if (config.alipay?.privateKey && !isEncrypted(config.alipay.privateKey)) return true;
        if (config.wechatpay?.privateKey && !isEncrypted(config.wechatpay.privateKey)) return true;
        if (config.wechatpay?.apiKey && !isEncrypted(config.wechatpay.apiKey)) return true;
        if (config.douyinpay?.appSecret && !isEncrypted(config.douyinpay.appSecret)) return true;
        if (config.douyinpay?.privateKey && !isEncrypted(config.douyinpay.privateKey)) return true;
        return false;
    }
}
