import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addRiderLocationSql = "\nCREATE TABLE IF NOT EXISTS campus_rider_location (\n  id SERIAL PRIMARY KEY,\n  \"createdAt\" timestamptz DEFAULT now(),\n  \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL,\n  \"orderId\" int NOT NULL,\n  \"riderCustomerId\" int NOT NULL,\n  lat double precision NOT NULL,\n  lng double precision NOT NULL,\n  \"reportedAt\" timestamptz NOT NULL);\nCREATE INDEX IF NOT EXISTS idx_campus_rider_location_order ON campus_rider_location (\"orderId\", \"reportedAt\");\nCREATE INDEX IF NOT EXISTS idx_campus_rider_location_rider ON campus_rider_location (\"channelId\", \"riderCustomerId\", \"reportedAt\");\nCREATE INDEX IF NOT EXISTS idx_campus_rider_earning_channel_created ON rider_earning (\"channelId\", \"createdAt\");\nCREATE INDEX IF NOT EXISTS idx_campus_rider_earning_rider_created ON rider_earning (\"riderCustomerId\", \"createdAt\");\n";
export declare class AddRiderLocationMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
