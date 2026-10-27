import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P6TasteProfileSql = "\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsTasteprofile\" text\n";
export declare class P9P6TasteProfileMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
