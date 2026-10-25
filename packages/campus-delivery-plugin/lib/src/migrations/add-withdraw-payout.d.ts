import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addWithdrawPayoutSql = "\nCREATE TABLE IF NOT EXISTS rider_withdrawal_request (\n  id SERIAL PRIMARY KEY,\n  \"createdAt\" timestamptz DEFAULT now(),\n  \"updatedAt\" timestamptz DEFAULT now(),\n  \"customerId\" int NOT NULL,\n  \"channelId\" int NOT NULL,\n  amount int NOT NULL,\n  channel varchar(255) NOT NULL,\n  account varchar(255) NOT NULL,\n  status varchar(255) DEFAULT 'PENDING',\n  remark varchar(255),\n  \"reviewedBy\" varchar(255),\n  \"reviewedAt\" timestamp,\n  \"payoutRef\" varchar(255),\n  \"payoutProof\" varchar(255),\n  \"failReason\" varchar(255));\nALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS \"payoutRef\" varchar(255);\nALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS \"payoutProof\" varchar(255);\nALTER TABLE rider_withdrawal_request ADD COLUMN IF NOT EXISTS \"failReason\" varchar(255);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"shiftCheckEnabled\" boolean DEFAULT false;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"blacklistAutoCancelCount\" integer NOT NULL DEFAULT 0;\nALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS \"customFieldsCampuscancelcause\" varchar(255);\n";
export declare class AddWithdrawPayoutMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
