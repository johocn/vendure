// P2-3 批次（2026-10-27）：广告位与商家自助投放计费（按天计费）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p9P3AdCampaignSql = `
CREATE TABLE IF NOT EXISTS campus_ad_campaign (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, slot varchar(32) NOT NULL, title varchar(64) NOT NULL,
  "imageUrl" varchar(512), "linkUrl" varchar(255), "startDate" date NOT NULL, "endDate" date NOT NULL,
  days int NOT NULL, "unitPriceFen" int NOT NULL, "totalFen" int NOT NULL,
  status varchar(16) DEFAULT 'pendingPay', "payRef" varchar(64), "paidAt" timestamptz,
  "reviewNote" text, "reviewedBy" varchar(255), "reviewedAt" timestamptz, "createdBy" varchar(255));
CREATE INDEX IF NOT EXISTS idx_campus_ad_channel_slot ON campus_ad_campaign ("channelId", slot, status)
`;

@Injectable()
export class P9P3AdCampaignMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p9P3AdCampaignSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P9P3AdCampaignMigration] failed:', e?.message);
        }
    }
}
