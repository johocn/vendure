import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p17AfterSalesNoteSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_note (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"content\" text NOT NULL,\n  \"createdBy\" varchar NOT NULL DEFAULT 'merchant'\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_note_request\n  ON campus_after_sales_note (\"channelId\", \"requestId\");\n";
export declare class P17AfterSalesNoteMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
