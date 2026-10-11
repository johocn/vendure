import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { DiyPluginOptions } from './types';
export declare class DiySeedRunner {
    private connection;
    constructor(connection: TransactionalConnection);
    run(): Promise<void>;
}
export declare class DiyPlugin implements OnApplicationBootstrap {
    private options;
    private seedRunner;
    private static options;
    static init(options?: DiyPluginOptions): Type<DiyPlugin>;
    constructor(options: DiyPluginOptions, seedRunner: DiySeedRunner);
    onApplicationBootstrap(): Promise<void>;
}
