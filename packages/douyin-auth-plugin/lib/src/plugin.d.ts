import { Type } from '@nestjs/common';
import { DouyinAuthPluginOptions } from './types';
export declare class DouyinAuthPlugin {
    private options;
    private static options;
    constructor(options: DouyinAuthPluginOptions);
    static init(options: DouyinAuthPluginOptions): Type<DouyinAuthPlugin>;
}
