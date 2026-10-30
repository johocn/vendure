// §88（2026-10-30）：商家售后标签 + 售后单打标关联（本店渠道共用，顾客端不可见）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p19AfterSalesTagSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_tag (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "name" varchar(12) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_tag_channel_name
  ON campus_after_sales_tag ("channelId", "name");
CREATE TABLE IF NOT EXISTS campus_after_sales_tag_link (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "tagId" integer NOT NULL,
  UNIQUE ("channelId", "requestId", "tagId")
);
CREATE INDEX IF NOT EXISTS campus_after_sales_tag_link_request
  ON campus_after_sales_tag_link ("requestId");
`;

@Injectable()
export class P19AfterSalesTagMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p19AfterSalesTagSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P19AfterSalesTagMigration] failed:', e?.message);
        }
    }
}
