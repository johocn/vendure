// P2-2 批次（2026-10-27）：语音/拍照搜索服务商按渠道配置（mock / none）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P2SearchAssistSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "voiceSearchProvider" varchar(16) NOT NULL DEFAULT 'mock';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "imageSearchProvider" varchar(16) NOT NULL DEFAULT 'mock';
`;

@Injectable()
export class P9P2SearchAssistMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P2SearchAssistSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P2SearchAssistMigration] failed:', e?.message);
        }
    }
}
