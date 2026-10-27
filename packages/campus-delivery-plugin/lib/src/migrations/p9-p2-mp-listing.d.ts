import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P2MpListingSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"mpAppId\" varchar(64);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"mpCategory\" varchar(64);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"mpVersion\" varchar(32);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"mpListingStatus\" varchar(16) NOT NULL DEFAULT 'draft';\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"mpPrivacyUrl\" varchar(255);\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"mpReviewNote\" varchar(500);\n";
export declare class P9P2MpListingMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
