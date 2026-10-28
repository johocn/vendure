import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/**
 * P4-4 前端埋点与错误上报（2026-10-28）：行为事件 + 错误报告两张表。
 * 生产 synchronize: false，启动幂等补表（IF NOT EXISTS，重复启动安全）。
 */
export declare const p11TelemetrySql = "\nCREATE TABLE IF NOT EXISTS campus_track_event (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL, \"customerId\" int, \"sessionId\" varchar(64),\n  \"eventName\" varchar(64) NOT NULL, page varchar(128), props jsonb, ua varchar(255), ip varchar(64));\nCREATE INDEX IF NOT EXISTS idx_campus_track_event_channel_time ON campus_track_event (\"channelId\", \"createdAt\");\nCREATE INDEX IF NOT EXISTS idx_campus_track_event_channel_name ON campus_track_event (\"channelId\", \"eventName\");\nCREATE TABLE IF NOT EXISTS campus_error_report (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL, source varchar(16) NOT NULL, level varchar(16) NOT NULL DEFAULT 'error',\n  message text NOT NULL, stack text, page varchar(128), url varchar(500), ua varchar(255), \"customerId\" int);\nCREATE INDEX IF NOT EXISTS idx_campus_error_report_channel_time ON campus_error_report (\"channelId\", \"createdAt\");\n";
export declare class P11TelemetryMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
