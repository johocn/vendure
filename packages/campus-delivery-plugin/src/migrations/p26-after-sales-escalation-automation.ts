// §96（2026-10-31）：售后 SLA 暂停原因与时间线 + 平台仲裁升级 + 自动分配/异常预警配置。
// 生产 synchronize: false，启动幂等建表/补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p26AfterSalesEscalationAutomationSql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaPausedReason" varchar(200);
CREATE TABLE IF NOT EXISTS campus_after_sales_sla_pause (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  reason varchar(200) NOT NULL,
  "pausedAt" timestamptz NOT NULL DEFAULT now(),
  "resumedAt" timestamptz,
  "pausedMs" bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS campus_after_sales_sla_pause_request
  ON campus_after_sales_sla_pause ("channelId", "requestId");
CREATE TABLE IF NOT EXISTS campus_after_sales_escalation (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  reason varchar(200) NOT NULL,
  priority varchar(8) NOT NULL DEFAULT 'normal',
  status varchar(16) NOT NULL DEFAULT 'Open',
  "createdBy" integer,
  "resolvedAt" timestamptz,
  resolution text
);
CREATE INDEX IF NOT EXISTS campus_after_sales_escalation_channel
  ON campus_after_sales_escalation ("channelId", status);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_escalation_open
  ON campus_after_sales_escalation ("requestId") WHERE status = 'Open';
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesautoassignenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesautoassignmax" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertenabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertrefundrate" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertoverduecount" integer;
ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "customFieldsWaimaiaftersalesalertlastday" varchar(10);
`;

@Injectable()
export class P26AfterSalesEscalationAutomationMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p26AfterSalesEscalationAutomationSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P26AfterSalesEscalationAutomationMigration] failed:', e?.message);
        }
    }
}
