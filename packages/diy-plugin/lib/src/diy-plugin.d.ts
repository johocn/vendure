import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus, TransactionalConnection } from '@vendure/core';
import { DiyStockService } from './diy-stock.service';
import { DiyPluginOptions } from './types';
export declare class DiySeedRunner {
    private connection;
    constructor(connection: TransactionalConnection);
    run(): Promise<void>;
}
export declare class DiyPlugin implements OnApplicationBootstrap {
    private options;
    private seedRunner;
    private connection;
    private stockService;
    private eventBus;
    private static options;
    static init(options?: DiyPluginOptions): Type<DiyPlugin>;
    constructor(options: DiyPluginOptions, seedRunner: DiySeedRunner, connection: TransactionalConnection, stockService: DiyStockService, eventBus: EventBus);
    onApplicationBootstrap(): Promise<void>;
}
