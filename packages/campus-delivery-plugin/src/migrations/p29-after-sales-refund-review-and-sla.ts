// §99（2026-10-31）：大额退款二次复核表 + 转交原因列 + SLA 营业时段截止时间列。
// 生产 synchronize: false，启动幂等执行（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p29AfterSalesRefundReviewAndSlaSql = `
ALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS "slaDeadlineAt" timestamptz;
ALTER TABLE campus_after_sales_assign_log ADD COLUMN IF NOT EXISTS reason varchar(200);
CREATE TABLE IF NOT EXISTS campus_after_sales_refund_review (
  "id" serial PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "channelId" integer NOT NULL,
  "requestId" integer NOT NULL,
  amount integer NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'Pending',
  "requestedBy" integer,
  "requestedAt" timestamptz NOT NULL DEFAULT now(),
  "reviewedBy" integer,
  "reviewedAt" timestamptz,
  note varchar(200)
);
CREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_refund_review_pending
  ON campus_after_sales_refund_review ("channelId", "requestId") WHERE status = 'Pending';
CREATE INDEX IF NOT EXISTS campus_after_sales_refund_review_channel
  ON campus_after_sales_refund_review ("channelId", status, "createdAt");
`;

@Injectable()
export class P29AfterSalesRefundReviewAndSlaMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p29AfterSalesRefundReviewAndSlaSql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P29AfterSalesRefundReviewAndSlaMigration] failed:', e?.message);
        }
    }
}
