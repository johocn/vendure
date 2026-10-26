// P0 批次（2026-10-26）：号码保护 + 食安公示 + 在线客服 IM + 差评申诉。
// 生产 synchronize: false，启动幂等补列/建表（IF NOT EXISTS，重复启动安全）。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p8P0Sql = `
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberProvider" varchar(32) NOT NULL DEFAULT 'mask';
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberTtlMinutes" int NOT NULL DEFAULT 60;
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "privacyNumberPrefix" varchar(32);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodLicenseNo" varchar(64);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodLicenseImage" varchar(512);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodLicenseExpiry" varchar(16);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodSafetyGrade" varchar(8);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "foodSafetyCommitmentImage" varchar(512);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "kitchenLiveUrl" varchar(512);
ALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS "kitchenLiveEnabled" boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS campus_chat_conversation (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL,
  "customerId" int NOT NULL,
  "orderCode" varchar(64),
  subject varchar(128),
  status varchar(16) NOT NULL DEFAULT 'open',
  "lastMessage" varchar(200),
  "lastMessageAt" timestamptz,
  "lastSenderType" varchar(16),
  "unreadForCustomer" int NOT NULL DEFAULT 0,
  "unreadForAdmin" int NOT NULL DEFAULT 0,
  "closedAt" timestamptz);
CREATE INDEX IF NOT EXISTS idx_campus_chat_conv_channel ON campus_chat_conversation ("channelId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_campus_chat_conv_customer ON campus_chat_conversation ("channelId", "customerId");
CREATE TABLE IF NOT EXISTS campus_chat_message (
  id SERIAL PRIMARY KEY,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "conversationId" int NOT NULL,
  "senderType" varchar(16) NOT NULL,
  "senderId" int,
  content text,
  images text,
  "readAt" timestamptz);
CREATE INDEX IF NOT EXISTS idx_campus_chat_msg_conv ON campus_chat_message ("conversationId", id);
`;

/** review 表可能未安装 review-plugin：单独 DO 块判存在再补列 */
export const p8ReviewAppealSql = `
DO $$
BEGIN
  IF to_regclass('review') IS NOT NULL THEN
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealStatus" varchar(16);
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealReason" text;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealImages" text;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealAt" timestamptz;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealResult" text;
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealReviewedBy" varchar(64);
    ALTER TABLE review ADD COLUMN IF NOT EXISTS "appealReviewedAt" timestamptz;
  END IF;
END
$$;
`;

@Injectable()
export class P8P0Migration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p8P0Sql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
                await qr.query(p8ReviewAppealSql);
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P8P0Migration] failed:', e?.message);
        }
    }
}
