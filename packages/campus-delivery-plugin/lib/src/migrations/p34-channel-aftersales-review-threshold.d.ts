import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p34ChannelAfterSalesReviewThresholdSql = "\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaftersalesreviewthreshold\" int;\n";
export declare class P34ChannelAfterSalesReviewThresholdMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
