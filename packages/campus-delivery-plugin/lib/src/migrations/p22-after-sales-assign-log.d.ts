import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p22AfterSalesAssignLogSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_assign_log (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"fromUserId\" integer,\n  \"toUserId\" integer\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_assign_log_request\n  ON campus_after_sales_assign_log (\"requestId\");\n";
export declare class P22AfterSalesAssignLogMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
