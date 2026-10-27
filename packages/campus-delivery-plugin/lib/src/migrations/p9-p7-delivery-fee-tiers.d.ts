import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p9P7DeliveryFeeTiersSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"deliveryFeeTiers\" jsonb;\n";
export declare class P9P7DeliveryFeeTiersMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
