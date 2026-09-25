import { OnApplicationBootstrap } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
export declare class CollectionIconMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: TransactionalConnection);
    onApplicationBootstrap(): Promise<void>;
}
