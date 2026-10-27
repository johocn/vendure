import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P3AdCampaignSql = "\nCREATE TABLE IF NOT EXISTS campus_ad_campaign (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL, slot varchar(32) NOT NULL, title varchar(64) NOT NULL,\n  \"imageUrl\" varchar(512), \"linkUrl\" varchar(255), \"startDate\" date NOT NULL, \"endDate\" date NOT NULL,\n  days int NOT NULL, \"unitPriceFen\" int NOT NULL, \"totalFen\" int NOT NULL,\n  status varchar(16) DEFAULT 'pendingPay', \"payRef\" varchar(64), \"paidAt\" timestamptz,\n  \"reviewNote\" text, \"reviewedBy\" varchar(255), \"reviewedAt\" timestamptz, \"createdBy\" varchar(255));\nCREATE INDEX IF NOT EXISTS idx_campus_ad_channel_slot ON campus_ad_campaign (\"channelId\", slot, status)\n";
export declare class P9P3AdCampaignMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
