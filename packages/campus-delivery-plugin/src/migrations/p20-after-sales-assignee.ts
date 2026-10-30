// §89（2026-10-30）：售后单指派处理人（本店渠道，管理员 user id）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p20AfterSalesAssigneeSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_assignee (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "assigneeUserId" integer NOT NULL,
  UNIQUE ("channelId", "requestId")
);
CREATE INDEX IF NOT EXISTS campus_after_sales_assignee_user
  ON campus_after_sales_assignee ("channelId", "assigneeUserId");
`;

@Injectable()
export class P20AfterSalesAssigneeMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p20AfterSalesAssigneeSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P20AfterSalesAssigneeMigration] failed:', e?.message);
        }
    }
}
