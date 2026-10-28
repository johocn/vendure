import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/**
 * P4-2 评价品质闭环（2026-10-28）：差评预警规则 + 预警记录两张表。
 * 生产 synchronize: false，启动幂等补表（IF NOT EXISTS，重复启动安全）。
 */
export declare const p10ReviewAlertSql = "\nCREATE TABLE IF NOT EXISTS campus_review_alert_rule (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL, enabled boolean DEFAULT true, \"maxRating\" int DEFAULT 2,\n  \"couponTemplateId\" varchar(255),\n  UNIQUE (\"channelId\"));\nCREATE TABLE IF NOT EXISTS campus_review_alert (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"reviewId\" int NOT NULL, \"channelId\" int NOT NULL, \"productId\" int NOT NULL, \"customerId\" int NOT NULL,\n  rating int NOT NULL, content text NOT NULL, tags jsonb,\n  \"couponStatus\" varchar(255) DEFAULT 'none', \"couponCode\" varchar(255),\n  status varchar(255) DEFAULT 'new', note text, \"handledAt\" timestamptz,\n  UNIQUE (\"reviewId\"));\nCREATE INDEX IF NOT EXISTS idx_campus_review_alert_channel ON campus_review_alert (\"channelId\", status);\n";
export declare class P10ReviewAlertMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
