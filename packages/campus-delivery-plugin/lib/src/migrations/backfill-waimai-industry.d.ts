import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const backfillWaimaiIndustrySql = "\nUPDATE channel\nSET \"customFieldsIndustrytype\" = 'catering'\nWHERE \"customFieldsIndustrytype\" IS NULL\n  AND id IN (SELECT \"channelId\" FROM campus_fulfillment_config);\n";
export declare class BackfillWaimaiIndustryMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
