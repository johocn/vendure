import { Type } from '@nestjs/common';
import { ShopPluginOptions } from './types';
export declare class ShopPlugin {
    private options;
    private static options;
    constructor(options: ShopPluginOptions);
    static init(options?: ShopPluginOptions): Type<ShopPlugin>;
}
