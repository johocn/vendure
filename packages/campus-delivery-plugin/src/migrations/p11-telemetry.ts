import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

/**
 * P4-4 前端埋点与错误上报（2026-10-28）：行为事件 + 错误报告两张表。
 * 生产 synchronize: false，启动幂等补表（IF NOT EXISTS，重复启动安全）。
 */
export const p11TelemetrySql = `
CREATE TABLE IF NOT EXISTS campus_track_event (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, "customerId" int, "sessionId" varchar(64),
  "eventName" varchar(64) NOT NULL, page varchar(128), props jsonb, ua varchar(255), ip varchar(64));
CREATE INDEX IF NOT EXISTS idx_campus_track_event_channel_time ON campus_track_event ("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_campus_track_event_channel_name ON campus_track_event ("channelId", "eventName");
CREATE TABLE IF NOT EXISTS campus_error_report (
  id SERIAL PRIMARY KEY, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(),
  "channelId" int NOT NULL, source varchar(16) NOT NULL, level varchar(16) NOT NULL DEFAULT 'error',
  message text NOT NULL, stack text, page varchar(128), url varchar(500), ua varchar(255), "customerId" int);
CREATE INDEX IF NOT EXISTS idx_campus_error_report_channel_time ON campus_error_report ("channelId", "createdAt");
`;

@Injectable()
export class P11TelemetryMigration implements OnApplicationBootstrap {
    constructor(@InjectConnection() private connection: Connection) {}

    async onApplicationBootstrap() {
        try {
            const qr = this.connection.createQueryRunner();
            try {
                for (const statement of p11TelemetrySql.split(';').map(s => s.trim()).filter(Boolean)) {
                    await qr.query(statement);
                }
            } finally {
                await qr.release();
            }
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('[P11TelemetryMigration] failed:', e?.message);
        }
    }
}
