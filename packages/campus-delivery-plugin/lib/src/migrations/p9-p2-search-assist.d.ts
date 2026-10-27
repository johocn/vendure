import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P2SearchAssistSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"voiceSearchProvider\" varchar(16) NOT NULL DEFAULT 'mock';\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"imageSearchProvider\" varchar(16) NOT NULL DEFAULT 'mock';\n";
export declare class P9P2SearchAssistMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
