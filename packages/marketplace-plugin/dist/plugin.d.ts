import { OnApplicationBootstrap } from '@nestjs/common';
import { EntityHydrator, EventBus, TransactionalConnection } from '@vendure/core';
import { LedgerService } from './ledger.service';
import { MarketplacePluginOptions } from './types';
export declare class MarketplacePlugin implements OnApplicationBootstrap {
    private eventBus;
    private connection;
    private entityHydrator;
    private ledgerService;
    static options: MarketplacePluginOptions;
    constructor(eventBus: EventBus, connection: TransactionalConnection, entityHydrator: EntityHydrator, ledgerService: LedgerService);
    static init(options: MarketplacePluginOptions): typeof MarketplacePlugin;
    onApplicationBootstrap(): Promise<void>;
}
