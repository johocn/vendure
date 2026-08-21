import { Type } from '@nestjs/common';
import { OperationPluginOptions } from './types';
export declare class OperationPlugin {
    private options;
    private static options;
    constructor(options: OperationPluginOptions);
    static init(options?: OperationPluginOptions): Type<OperationPlugin>;
}
