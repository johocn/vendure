import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/** 履约配置加一列休业日期（simple-json 存 text：数组 [{date, note}]） */
export declare const p14ClosureCalendarSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"closureDates\" text;\n";
export declare class P14ClosureCalendarMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
