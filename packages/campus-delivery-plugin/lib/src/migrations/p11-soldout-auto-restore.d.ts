import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p11SoldOutAutoRestoreSql = "\nCREATE TABLE IF NOT EXISTS campus_soldout_batch (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"productId\" integer NOT NULL\n);\nCREATE UNIQUE INDEX IF NOT EXISTS campus_soldout_batch_channel_product\n  ON campus_soldout_batch (\"channelId\", \"productId\");\nALTER TABLE channel ADD COLUMN IF NOT EXISTS \"customFieldsWaimaisoldoutautorestore\" boolean DEFAULT true;\n";
export declare class P11SoldOutAutoRestoreMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
