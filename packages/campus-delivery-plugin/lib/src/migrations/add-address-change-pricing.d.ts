import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addAddressChangePricingSql = "\nCREATE TABLE IF NOT EXISTS campus_address_change (\n    \"id\" serial PRIMARY KEY,\n    \"createdAt\" timestamp NOT NULL DEFAULT now(),\n    \"updatedAt\" timestamp NOT NULL DEFAULT now(),\n    \"channelId\" int NOT NULL,\n    \"orderId\" int NOT NULL,\n    \"orderCode\" varchar NOT NULL,\n    \"customerId\" int,\n    \"fromZone\" varchar NOT NULL,\n    \"fromBuilding\" varchar NOT NULL,\n    \"fromDetail\" varchar,\n    \"toZone\" varchar NOT NULL,\n    \"toBuilding\" varchar NOT NULL,\n    \"toDetail\" varchar,\n    \"oldFee\" int NOT NULL DEFAULT 0,\n    \"newFee\" int NOT NULL DEFAULT 0,\n    \"diff\" int NOT NULL DEFAULT 0,\n    \"status\" varchar NOT NULL DEFAULT 'pending',\n    \"settledAt\" timestamp,\n    \"settledBy\" int,\n    \"settleAction\" varchar\n);\nCREATE INDEX IF NOT EXISTS idx_campus_address_change_channel ON campus_address_change (\"channelId\", \"status\");\nCREATE INDEX IF NOT EXISTS idx_campus_address_change_order ON campus_address_change (\"orderId\");\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"dynamicPricing\" jsonb;\nALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS \"customFieldsDeliverydetail\" varchar;\n";
export declare class AddAddressChangePricingMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
