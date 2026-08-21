import { Type } from '@nestjs/common';
import { FavoritePluginOptions } from './types';
export declare class FavoritePlugin {
    private options;
    private static options;
    constructor(options: FavoritePluginOptions);
    static init(options?: FavoritePluginOptions): Type<FavoritePlugin>;
}
