import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p3DataCleanupSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"notifyTemplateAddressChanged\" varchar;\nALTER TABLE \"order\" DROP COLUMN IF EXISTS \"customFieldsthirdpartyfee\";\n";
export declare class P3DataCleanupMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
