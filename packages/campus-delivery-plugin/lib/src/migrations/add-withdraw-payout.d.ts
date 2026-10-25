import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addWithdrawPayoutSql = "\nALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS \"payoutRef\" varchar(255);\nALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS \"payoutProof\" varchar(255);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"shiftCheckEnabled\" boolean DEFAULT false;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"blacklistAutoCancelCount\" integer NOT NULL DEFAULT 0;\nALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS \"customFieldsCampuscancelcause\" varchar(255);\n";
export declare class AddWithdrawPayoutMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
