import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addAddressChangeSettleProofSql = "\nALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS \"settleNote\" varchar;\nALTER TABLE campus_address_change ADD COLUMN IF NOT EXISTS \"refundId\" int;\n";
export declare class AddAddressChangeSettleProofMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
