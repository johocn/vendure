// P7 运营域补表（2026-10-25）：客服工单 / 骑手申诉 / 下单黑名单 / 骑手排班 / 在线会话 / 骑手评分，
// 并为 Product 补「一键沽清」自定义字段列（生产 synchronize: false，需启动幂等补列）。
// 全部 IF NOT EXISTS：重复启动安全，无数据翻写。
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

export const p7OpsTablesSql = `
CREATE TABLE IF NOT EXISTS campus_support_ticket (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "customerId" int NOT NULL, "orderCode" varchar(255),
  category varchar(255) NOT NULL, content text NOT NULL, images text,
  status varchar(255) DEFAULT 'open', reply text, "repliedBy" varchar(255), "repliedAt" timestamptz);
CREATE INDEX IF NOT EXISTS idx_campus_support_ticket_channel ON campus_support_ticket ("channelId", status);
CREATE TABLE IF NOT EXISTS campus_rider_appeal (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "riderCustomerId" int NOT NULL, "orderId" int, "orderCode" varchar(255),
  reason text NOT NULL, images text, status varchar(255) DEFAULT 'pending',
  "creditDelta" int DEFAULT 0, "reviewNote" text, "reviewedBy" varchar(255), "reviewedAt" timestamptz);
CREATE INDEX IF NOT EXISTS idx_campus_rider_appeal_channel ON campus_rider_appeal ("channelId", status);
CREATE TABLE IF NOT EXISTS campus_blacklist (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, type varchar(255) NOT NULL, "customerId" int, phone varchar(255),
  reason varchar(255), "createdBy" varchar(255), active boolean DEFAULT true);
CREATE INDEX IF NOT EXISTS idx_campus_blacklist_channel ON campus_blacklist ("channelId", active);
CREATE TABLE IF NOT EXISTS campus_rider_shift (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "riderCustomerId" int NOT NULL, "shiftDate" varchar(255) NOT NULL,
  "startTime" varchar(255) NOT NULL, "endTime" varchar(255) NOT NULL, note varchar(255));
CREATE INDEX IF NOT EXISTS idx_campus_rider_shift_day ON campus_rider_shift ("channelId", "shiftDate");
CREATE TABLE IF NOT EXISTS campus_rider_session (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "riderCustomerId" int NOT NULL, "startedAt" timestamptz NOT NULL,
  "endedAt" timestamptz, "lastHeartbeatAt" timestamptz, minutes int);
CREATE INDEX IF NOT EXISTS idx_campus_rider_session_rider ON campus_rider_session ("channelId", "riderCustomerId");
CREATE TABLE IF NOT EXISTS campus_rider_review (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "riderCustomerId" int NOT NULL, "orderId" int NOT NULL,
  rating int NOT NULL, tags text, comment varchar(255),
  UNIQUE ("orderId", "channelId"));
ALTER TABLE product ADD COLUMN IF NOT EXISTS "customFieldsWaimaisoldout" boolean DEFAULT false;
`;

@Injectable()
export class P7OpsTablesMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                const statements = p7OpsTablesSql
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
            console.error('[P7OpsTablesMigration] failed:', e?.message);
        }
    }
}
