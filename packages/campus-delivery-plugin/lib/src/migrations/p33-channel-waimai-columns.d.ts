import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p33ChannelWaimaiColumnsSql = "\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaitags\" varchar;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaimonthlysales\" int;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimailogo\" varchar;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaipromotext\" varchar;\nALTER TABLE \"channel\" ADD COLUMN IF NOT EXISTS \"customFieldsWaimaibusinesshours\" varchar;\n";
export declare class P33ChannelWaimaiColumnsMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
