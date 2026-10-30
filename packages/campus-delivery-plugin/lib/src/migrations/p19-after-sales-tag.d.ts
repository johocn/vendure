import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p19AfterSalesTagSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_tag (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"name\" varchar(12) NOT NULL\n);\nCREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_tag_channel_name\n  ON campus_after_sales_tag (\"channelId\", \"name\");\nCREATE TABLE IF NOT EXISTS campus_after_sales_tag_link (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"tagId\" integer NOT NULL,\n  UNIQUE (\"channelId\", \"requestId\", \"tagId\")\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_tag_link_request\n  ON campus_after_sales_tag_link (\"requestId\");\n";
export declare class P19AfterSalesTagMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
