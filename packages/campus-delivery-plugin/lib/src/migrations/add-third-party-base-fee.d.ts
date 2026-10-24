import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addThirdPartyBaseFeeSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"thirdPartyBaseFee\" int;\n";
export declare class AddThirdPartyBaseFeeMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
