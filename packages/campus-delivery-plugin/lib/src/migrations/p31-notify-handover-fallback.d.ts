import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p31NotifyHandoverFallbackSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"notifyTemplateArrivedHandover\" varchar;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"notifyTemplateDeliveryFallback\" varchar;\n";
export declare class P31NotifyHandoverFallbackMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
