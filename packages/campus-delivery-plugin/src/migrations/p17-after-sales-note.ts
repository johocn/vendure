// §86（2026-10-30）：商家售后内部备注（仅商家可见，顾客端不展示）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p17AfterSalesNoteSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_note (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "content" text NOT NULL,
  "createdBy" varchar NOT NULL DEFAULT 'merchant'
);
CREATE INDEX IF NOT EXISTS campus_after_sales_note_request
  ON campus_after_sales_note ("channelId", "requestId");
`;

@Injectable()
export class P17AfterSalesNoteMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p17AfterSalesNoteSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P17AfterSalesNoteMigration] failed:', e?.message);
        }
    }
}
