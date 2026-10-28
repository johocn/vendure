import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare class AddSettlementCouponCostMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
