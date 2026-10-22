import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const addRouteDeliveryConfigSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"routeFirstLeg\" jsonb;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"handoverPoints\" jsonb;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"providerShopNo\" jsonb;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"merchantAcceptMinutes\" int DEFAULT 5;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"externalPushTimeoutMinutes\" int DEFAULT 10;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"externalFallbackMinutes\" int DEFAULT 20;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"storeLat\" double precision;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"storeLng\" double precision;\n";
export declare class AddRouteDeliveryConfigMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
