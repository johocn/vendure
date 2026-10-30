import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p21AfterSalesSlaAlertSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_sla_alert (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"kind\" varchar(16) NOT NULL,\n  \"alertedAt\" timestamptz NOT NULL DEFAULT now(),\n  UNIQUE (\"requestId\", \"kind\")\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_sla_alert_time\n  ON campus_after_sales_sla_alert (\"alertedAt\");\n";
export declare class P21AfterSalesSlaAlertMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
