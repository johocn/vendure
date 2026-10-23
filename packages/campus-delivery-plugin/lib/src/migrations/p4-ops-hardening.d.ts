import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p4OpsHardeningSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"timeoutCompensationWindowHours\" integer NOT NULL DEFAULT 24;\nUPDATE \"order\" SET \"customFieldsHallstatus\" = 'delivered'\nWHERE \"customFieldsDeliverystatus\" = 'delivered'\n  AND \"customFieldsHallstatus\" IS NOT NULL\n  AND \"customFieldsHallstatus\" NOT IN ('delivered', 'cancelled', 'no_rider_final', 'exception_final');\n";
export declare class P4OpsHardeningMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
