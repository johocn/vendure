// §98（2026-10-31）：商品维度售后分析所需审计列 + 退货物流轨迹 + 自动分流规则 + 评价标签。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p28AfterSalesProductAndRulesSql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "autoRuleAppliedAt" timestamptz;
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "autoRuleId" integer;
CREATE TABLE IF NOT EXISTS campus_after_sales_return_logistics (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  status varchar(16) NOT NULL,
  description varchar(200),
  "occurredAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" integer
);
CREATE INDEX IF NOT EXISTS campus_after_sales_return_logistics_request
  ON campus_after_sales_return_logistics ("channelId", "requestId", "occurredAt");
CREATE TABLE IF NOT EXISTS campus_after_sales_auto_rule (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  name varchar(100) NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  "matchType" varchar(16) NOT NULL DEFAULT '*',
  "matchReason" varchar(200),
  "minAmount" integer,
  "maxAmount" integer,
  action varchar(16) NOT NULL,
  "rejectReason" varchar(200)
);
CREATE INDEX IF NOT EXISTS campus_after_sales_auto_rule_channel
  ON campus_after_sales_auto_rule ("channelId", enabled, priority);
ALTER TABLE campus_after_sales_review ADD COLUMN IF NOT EXISTS tags text;
`;

@Injectable()
export class P28AfterSalesProductAndRulesMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p28AfterSalesProductAndRulesSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P28AfterSalesProductAndRulesMigration] failed:', e?.message);
        }
    }
}
