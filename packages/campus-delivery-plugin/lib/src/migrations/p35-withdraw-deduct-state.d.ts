import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p35WithdrawDeductStateSql = "\nALTER TABLE rider_withdrawal_request\n    ADD COLUMN IF NOT EXISTS \"withdrawState\" varchar DEFAULT 'confirmed';\n";
export declare class P35WithdrawDeductStateMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
