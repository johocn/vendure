import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p23AfterSalesReviewSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_review (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  \"customerId\" integer NOT NULL,\n  \"score\" integer NOT NULL,\n  \"comment\" text,\n  \"followedUp\" boolean NOT NULL DEFAULT false\n);\nCREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_review_request\n  ON campus_after_sales_review (\"requestId\");\nCREATE INDEX IF NOT EXISTS campus_after_sales_review_channel\n  ON campus_after_sales_review (\"channelId\", \"createdAt\");\n";
export declare class P23AfterSalesReviewMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
