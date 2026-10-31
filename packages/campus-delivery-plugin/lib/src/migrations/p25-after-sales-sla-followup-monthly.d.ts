import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p25AfterSalesSlaFollowupMonthlySql = "\nALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS \"slaPausedAt\" timestamptz;\nALTER TABLE after_sales_request ADD COLUMN IF NOT EXISTS \"slaPausedMs\" bigint NOT NULL DEFAULT 0;\nALTER TABLE campus_after_sales_followup ADD COLUMN IF NOT EXISTS \"remindedAt\" timestamptz;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaftersalesmonthlypushenabled\" boolean NOT NULL DEFAULT false;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaftersalesmonthlypushday\" integer;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaftersalesmonthlypushtime\" varchar(5);\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaftersalesmonthlypushlastmonth\" varchar(7);\n";
export declare class P25AfterSalesSlaFollowupMonthlyMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
