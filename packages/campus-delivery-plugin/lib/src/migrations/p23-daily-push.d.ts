import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p23DailyPushSql = "\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaidailypushenabled\" boolean NOT NULL DEFAULT false;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaidailypushtime\" varchar(5);\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaidailypushlastdate\" varchar(10);\n";
export declare class P23DailyPushMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
