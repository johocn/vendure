import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P5RiderComplianceSql = "\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderhealthcertno\" varchar(255);\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderhealthcertimg\" varchar(255);\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderhealthcertexpiry\" timestamp;\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderinsuranceno\" varchar(255);\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderinsuranceexpiry\" timestamp;\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderbackgroundcheck\" varchar(255);\nALTER TABLE \"customer\" ADD COLUMN IF NOT EXISTS \"customFieldsRiderbackgroundcheckat\" timestamp\n";
export declare class P9P5RiderComplianceMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
