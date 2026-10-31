import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p32CampusConfigMissingColumnsSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"freeShippingThreshold\" int;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"timeoutCompensationEnabled\" boolean DEFAULT true;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"timeoutGraceMinutes\" int DEFAULT 10;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"timeoutCompensationCouponTemplateId\" varchar;\nALTER TABLE campus_fulfillment_config ALTER COLUMN \"storeNotice\" TYPE varchar(500);\n";
export declare class P32CampusConfigMissingColumnsMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
