import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P4LockerSql = "\nCREATE TABLE IF NOT EXISTS campus_locker_station (\n  id SERIAL PRIMARY KEY, \"createdAt\" timestamptz DEFAULT now(), \"updatedAt\" timestamptz DEFAULT now(),\n  \"channelId\" int NOT NULL, name varchar(64) NOT NULL, location varchar(255) NOT NULL,\n  provider varchar(32) NOT NULL DEFAULT 'self', \"totalCells\" int NOT NULL DEFAULT 0,\n  \"availableCells\" int NOT NULL DEFAULT 0, \"openHours\" varchar(32), \"pickupGuide\" text,\n  enabled boolean NOT NULL DEFAULT true, sort int NOT NULL DEFAULT 0, \"createdBy\" varchar(255));\nCREATE INDEX IF NOT EXISTS idx_campus_locker_channel ON campus_locker_station (\"channelId\", enabled);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"unmannedDeliveryEnabled\" boolean NOT NULL DEFAULT false;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"unmannedDeliveryProvider\" varchar(16) NOT NULL DEFAULT 'mock';\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"unmannedDeliveryEndpoint\" varchar(255);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"unmannedDeliveryKey\" varchar(128)\n";
export declare class P9P4LockerMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
