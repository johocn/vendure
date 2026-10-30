// §93（2026-10-31）：退款后满意度回访（顾客 1-5 分 + 留言，商家低分跟进）。
// 生产 synchronize: false，启动幂等建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p23AfterSalesReviewSql = `
CREATE TABLE IF NOT EXISTS campus_after_sales_review (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  "customerId" integer NOT NULL,
  "score" integer NOT NULL,
  "comment" text,
  "followedUp" boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_review_request
  ON campus_after_sales_review ("requestId");
CREATE INDEX IF NOT EXISTS campus_after_sales_review_channel
  ON campus_after_sales_review ("channelId", "createdAt");
`;

@Injectable()
export class P23AfterSalesReviewMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p23AfterSalesReviewSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P23AfterSalesReviewMigration] failed:', e?.message);
        }
    }
}
