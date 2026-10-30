// §90（2026-10-30）：售后 SLA 主动提醒（临期 / 超时），向本店渠道管理员发站内信。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p21AfterSalesSlaAlertSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_sla_alert (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "kind" varchar(16) NOT NULL,
  "alertedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("requestId", "kind")
);
CREATE INDEX IF NOT EXISTS campus_after_sales_sla_alert_time
  ON campus_after_sales_sla_alert ("alertedAt");
`;

@Injectable()
export class P21AfterSalesSlaAlertMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p21AfterSalesSlaAlertSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P21AfterSalesSlaAlertMigration] failed:', e?.message);
        }
    }
}
