import { Type } from '@nestjs/common';
import { LogisticsPluginOptions } from './types';
export declare class LogisticsPlugin {
    private options;
    private static options;
    constructor(options: LogisticsPluginOptions);
    static init(options?: LogisticsPluginOptions): Type<LogisticsPlugin>;
}
