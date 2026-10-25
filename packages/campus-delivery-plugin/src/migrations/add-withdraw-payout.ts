// P2-2 提现打款留痕（2026-10-25）：通过提现时必须登记打款流水号/凭证；
// P3-1 接单班次校验开关（per-store 配置列）；
// P3-2 黑名单自动规则阈值 + 订单取消归因列（customFields 在 PG 中是独立列）。
// P8-1 补建表：本表历史上靠手工/同步创建，迁移目录缺 CREATE TABLE，新环境/灾备冷启动 ALTER 会失败；
// P8-2 打款失败回退：FAILED 状态 + failReason 留痕。
// 生产 synchronize: false，启动幂等补列（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const addWithdrawPayoutSql = `
CREATE TABLE IF NOT EXISTS rider_withdrawal_request (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "customerId" int NOT NULL,
  "channelId" int NOT NULL,
  amount int NOT NULL,
  channel varchar(255) NOT NULL,
  account varchar(255) NOT NULL,
  status varchar(255) DEFAULT 'PENDING',
  remark varchar(255),
  "reviewedBy" varchar(255),
  "reviewedAt" timestamp,
  "payoutRef" varchar(255),
  "payoutProof" varchar(255),
  "failReason" varchar(255));
ALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS "payoutRef" varchar(255);
ALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS "payoutProof" varchar(255);
ALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS "failReason" varchar(255);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "shiftCheckEnabled" boolean DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "blacklistAutoCancelCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customFieldsCampuscancelcause" varchar(255);
`;

@Injectable()
export class AddWithdrawPayoutMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const statements = addWithdrawPayoutSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean);
                for (const statement of statements) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[AddWithdrawPayoutMigration] failed:', e?.message);
        }
    }
}
