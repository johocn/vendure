import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const createCampusTables = "\nCREATE TABLE IF NOT EXISTS campus_zone (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  name varchar(255) NOT NULL, fee int NOT NULL DEFAULT 0, \"channelId\" int NOT NULL);\nCREATE TABLE IF NOT EXISTS campus_building (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  name varchar(255) NOT NULL, detail varchar(255), \"zoneId\" int NOT NULL, \"channelId\" int NOT NULL);\nCREATE TABLE IF NOT EXISTS rider_earning (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"orderId\" int NOT NULL, \"riderCustomerId\" int NOT NULL,\n  amount int NOT NULL, tip int NOT NULL DEFAULT 0, status varchar(255) DEFAULT 'credited', \"channelId\" int NOT NULL);\nCREATE TABLE IF NOT EXISTS campus_fulfillment_config (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL UNIQUE, \"routesEnabled\" jsonb, \"riderCommissionRate\" int DEFAULT 100,\n  \"autoAssignMinutes\" int DEFAULT 10, paused boolean DEFAULT false);\n";
export declare class CreateCampusTablesMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
