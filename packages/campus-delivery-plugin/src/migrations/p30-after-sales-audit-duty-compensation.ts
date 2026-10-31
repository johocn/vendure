// §100（2026-10-31）：售后操作审计留痕表 + 值班排班表 + 补偿挽留方案表。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p30AfterSalesAuditDutyCompensationSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_audit_log (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  action varchar(32) NOT NULL,
  "actorUserId" integer,
  "actorName" varchar(100),
  detail varchar(500)
);
CREATE INDEX IF NOT EXISTS campus_after_sales_audit_log_request
  ON campus_after_sales_audit_log ("channelId", "requestId", "createdAt");
CREATE INDEX IF NOT EXISTS campus_after_sales_audit_log_channel
  ON campus_after_sales_audit_log ("channelId", "createdAt");
CREATE TABLE IF NOT EXISTS campus_after_sales_duty (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  weekday smallint NOT NULL,
  "startMin" integer NOT NULL,
  "endMin" integer NOT NULL,
  "userId" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_duty_unique
  ON campus_after_sales_duty ("channelId", weekday, "startMin", "endMin", "userId");
CREATE INDEX IF NOT EXISTS campus_after_sales_duty_channel
  ON campus_after_sales_duty ("channelId", weekday, "startMin");
CREATE TABLE IF NOT EXISTS campus_after_sales_compensation_plan (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  name varchar(100) NOT NULL,
  "refundAmount" integer NOT NULL DEFAULT 0,
  "couponTemplateId" varchar(255),
  note varchar(200),
  enabled boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS campus_after_sales_compensation_plan_channel
  ON campus_after_sales_compensation_plan ("channelId", enabled);
`;

@Injectable()
export class P30AfterSalesAuditDutyCompensationMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p30AfterSalesAuditDutyCompensationSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P30AfterSalesAuditDutyCompensationMigration] failed:', e?.message);
        }
    }
}
