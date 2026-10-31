import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p24AfterSalesRiskFollowupSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_risk (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  reason text NOT NULL,\n  active boolean NOT NULL DEFAULT true\n);\nCREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_risk_request\n  ON campus_after_sales_risk (\"requestId\");\nCREATE INDEX IF NOT EXISTS campus_after_sales_risk_channel\n  ON campus_after_sales_risk (\"channelId\", active);\nCREATE TABLE IF NOT EXISTS campus_after_sales_followup (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"operatorUserId\" integer,\n  method varchar NOT NULL,\n  result varchar NOT NULL,\n  note text,\n  \"nextAt\" timestamptz\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_followup_request\n  ON campus_after_sales_followup (\"channelId\", \"requestId\");\n";
export declare class P24AfterSalesRiskFollowupMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
