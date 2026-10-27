// P2-1 批次（2026-10-27）：小程序上架配置（AppID/类目/版本/审核状态/隐私指引/审核备注）。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P2MpListingSql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "mpAppId" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "mpCategory" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "mpVersion" varchar(32);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "mpListingStatus" varchar(16) NOT NULL DEFAULT 'draft';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "mpPrivacyUrl" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "mpReviewNote" varchar(500);
`;

@Injectable()
export class P9P2MpListingMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P2MpListingSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P2MpListingMigration] failed:', e?.message);
        }
    }
}
