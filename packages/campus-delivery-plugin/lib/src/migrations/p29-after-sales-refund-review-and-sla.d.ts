import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p29AfterSalesRefundReviewAndSlaSql = "\nALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS \"slaDeadlineAt\" timestamptz;\nALTER TABLE campus_after_sales_assign_log ADD COLUMN IF NOT EXISTS reason varchar(200);\nCREATE TABLE IF NOT EXISTS campus_after_sales_refund_review (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"requestId\" integer NOT NULL,\n  amount integer NOT NULL,\n  status varchar(16) NOT NULL DEFAULT 'Pending',\n  \"requestedBy\" integer,\n  \"requestedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"reviewedBy\" integer,\n  \"reviewedAt\" timestamptz,\n  note varchar(200)\n);\nCREATE UNIQUE INDEX IF NOT EXISTS campus_after_sales_refund_review_pending\n  ON campus_after_sales_refund_review (\"channelId\", \"requestId\") WHERE status = 'Pending';\nCREATE INDEX IF NOT EXISTS campus_after_sales_refund_review_channel\n  ON campus_after_sales_refund_review (\"channelId\", status, \"createdAt\");\n";
export declare class P29AfterSalesRefundReviewAndSlaMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
