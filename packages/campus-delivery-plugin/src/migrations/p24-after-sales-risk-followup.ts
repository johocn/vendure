// §94（2026-10-31）：售后风险标记 + 顾客回访记录。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p24AfterSalesRiskFollowupSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_risk (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_risk_request
  ON campus_after_sales_risk ("requestId");
CREATE INDEX IF NOT EXISTS campus_after_sales_risk_channel
  ON campus_after_sales_risk ("channelId", active);
CREATE TABLE IF NOT EXISTS campus_after_sales_followup (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "operatorUserId" integer,
  method varchar NOT NULL,
  result varchar NOT NULL,
  note text,
  "nextAt" timestamptz
);
CREATE INDEX IF NOT EXISTS campus_after_sales_followup_request
  ON campus_after_sales_followup ("channelId", "requestId");
`;

@Injectable()
export class P24AfterSalesRiskFollowupMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p24AfterSalesRiskFollowupSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P24AfterSalesRiskFollowupMigration] failed:', e?.message);
        }
    }
}
