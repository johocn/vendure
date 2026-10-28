import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * P4-2 评价品质闭环（2026-10-28）：差评预警规则 + 预警记录两张表。
 * 生产 synchronize: false，启动幂等补表（IF NOT EXISTS，重复启动安全）。
 */
export const p10ReviewAlertSql = `
CREATE TABLE IF NOT EXISTS campus_review_alert_rule (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, enabled boolean DEFAULT true, "maxRating" int DEFAULT 2,
  "couponTemplateId" varchar(255),
  UNIQUE ("channelId"));
CREATE TABLE IF NOT EXISTS campus_review_alert (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "reviewId" int NOT NULL, "channelId" int NOT NULL, "productId" int NOT NULL, "customerId" int NOT NULL,
  rating int NOT NULL, content text NOT NULL, tags jsonb,
  "couponStatus" varchar(255) DEFAULT 'none', "couponCode" varchar(255),
  status varchar(255) DEFAULT 'new', note text, "handledAt" timestamptz,
  UNIQUE ("reviewId"));
CREATE INDEX IF NOT EXISTS idx_campus_review_alert_channel ON campus_review_alert ("channelId", status);
`;

@Injectable()
export class P10ReviewAlertMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p10ReviewAlertSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P10ReviewAlertMigration] failed:', e?.message);
        }
    }
}
