// packages/cjk-plugin/src/migrations/migrate-mapconfig-encryption.ts
import { RequestContext, ChannelService } from '@vendure/core';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { encryptMapConfig } from '../map/map-crypto';
import { isEncrypted } from '../auth/crypto';

export const MAP_CONFIG_MIGRATION_DONE = 'MAP_CONFIG_MIGRATION_DONE';
const DISCRIMINATOR = 'tenant-config-migration';

@Injectable()
export class MapConfigEncryptionMigration implements OnApplicationBootstrap {
    constructor(
        @InjectConnection() private connection: Connection,
        private channelService: ChannelService,
    ) {}

    async onApplicationBootstrap() {
        const ctx = RequestContext.empty();
        // 幂等检查:若已迁移过则跳过
        const done = await this.connection
            .createQueryBuilder()
            .select('id')
            .from('history_entry', 'he')
            .where('he.type = :type', { type: MAP_CONFIG_MIGRATION_DONE })
            .getRawOne();
        if (done) return;

        const channels = await this.channelService.findAll(ctx);
        let migrated = 0;
        for (const channel of channels.items) {
            const raw = (channel as any).customFields?.mapConfig;
            if (!raw) continue;
            const needsMigration =
                (raw.apiKey && !isEncrypted(raw.apiKey)) ||
                (raw.securityJsCode && !isEncrypted(raw.securityJsCode));
            if (!needsMigration) continue;
            const encrypted = encryptMapConfig(raw);
            await this.channelService.update(ctx, {
                id: channel.id as any,
                customFields: { mapConfig: encrypted },
            });
            migrated++;
        }
        // 用 query builder 直接插入(因 HistoryEntry 是 abstract 单表继承,不能 save 对象字面量)
        await this.connection
            .createQueryBuilder()
            .insert()
            .into('history_entry')
            .values({
                createdAt: () => 'NOW()',
                updatedAt: () => 'NOW()',
                type: MAP_CONFIG_MIGRATION_DONE,
                isPublic: false,
                data: JSON.stringify({ migrated }),
                discriminator: DISCRIMINATOR,
            })
            .execute();
    }
}
