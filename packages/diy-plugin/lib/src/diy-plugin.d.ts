import { Type } from '@nestjs/common';
import { DiyPluginOptions } from './types';
export declare class DiyServiceStub {
}
export declare class DiyPlugin {
    private static options;
    static init(options?: DiyPluginOptions): Type<DiyPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
