import { Type } from '@nestjs/common';
import { LogisticsApiPluginOptions } from './types';
export declare class LogisticsApiPlugin {
    private options;
    private static options;
    constructor(options: LogisticsApiPluginOptions);
    static init(options?: LogisticsApiPluginOptions): Type<LogisticsApiPlugin>;
}
