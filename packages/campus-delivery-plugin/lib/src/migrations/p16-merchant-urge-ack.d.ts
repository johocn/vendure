import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p16MerchantUrgeAckSql = "\nCREATE TABLE IF NOT EXISTS campus_urge_ack (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"orderId\" integer NOT NULL,\n  \"ackedAt\" timestamptz NOT NULL DEFAULT now()\n);\nCREATE UNIQUE INDEX IF NOT EXISTS campus_urge_ack_channel_order\n  ON campus_urge_ack (\"channelId\", \"orderId\");\n";
export declare class P16MerchantUrgeAckMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
