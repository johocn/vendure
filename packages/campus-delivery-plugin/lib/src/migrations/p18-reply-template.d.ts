import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p18ReplyTemplateSql = "\nCREATE TABLE IF NOT EXISTS campus_after_sales_reply_template (\n  \"id\" serial PRIMARY KEY,\n  \"createdAt\" timestamptz NOT NULL DEFAULT now(),\n  \"updatedAt\" timestamptz NOT NULL DEFAULT now(),\n  \"channelId\" integer NOT NULL,\n  \"content\" text NOT NULL\n);\nCREATE INDEX IF NOT EXISTS campus_after_sales_reply_template_channel\n  ON campus_after_sales_reply_template (\"channelId\");\n";
export declare class P18ReplyTemplateMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
