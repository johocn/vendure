import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p27AfterSalesTemplateCategorySql = "\nALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS category varchar(50);\nALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS keywords varchar(200);\nALTER TABLE campus_after_sales_reply_template ADD COLUMN IF NOT EXISTS \"sortOrder\" integer NOT NULL DEFAULT 0;\nCREATE INDEX IF NOT EXISTS campus_after_sales_reply_template_category\n  ON campus_after_sales_reply_template (\"channelId\", category);\n";
export declare class P27AfterSalesTemplateCategoryMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
