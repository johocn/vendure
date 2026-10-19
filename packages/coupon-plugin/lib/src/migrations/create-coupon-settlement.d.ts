import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare class CreateCouponSettlementMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
