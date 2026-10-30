import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p20AfterSalesAssigneeSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_assignee (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"assigneeUserId\" integer NOT NULL,\n  UNIQUE (\"channelId\", \"requestId\")\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_assignee_user\n  ON campus_after_sales_assignee (\"channelId\", \"assigneeUserId\");\n";
export declare class P20AfterSalesAssigneeMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
