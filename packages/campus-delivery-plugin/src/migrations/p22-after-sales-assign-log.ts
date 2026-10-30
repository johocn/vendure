// §92（2026-10-31）：售后指派变更历史（改派/取消留痕）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p22AfterSalesAssignLogSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_assign_log (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "fromUserId" integer,
  "toUserId" integer
);
CREATE INDEX IF NOT EXISTS campus_after_sales_assign_log_request
  ON campus_after_sales_assign_log ("requestId");
`;

@Injectable()
export class P22AfterSalesAssignLogMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p22AfterSalesAssignLogSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P22AfterSalesAssignLogMigration] failed:', e?.message);
        }
    }
}
