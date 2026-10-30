// §87（2026-10-30）：商家快捷回复模板（本店渠道共用，顾客端不可见）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p18ReplyTemplateSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_reply_template (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "content" text NOT NULL
);
CREATE INDEX IF NOT EXISTS campus_after_sales_reply_template_channel
  ON campus_after_sales_reply_template ("channelId");
`;

@Injectable()
export class P18ReplyTemplateMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p18ReplyTemplateSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P18ReplyTemplateMigration] failed:', e?.message);
        }
    }
}
