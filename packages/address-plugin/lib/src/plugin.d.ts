import { Type } from '@nestjs/common';
import { AddressPluginOptions } from './types';
export declare class AddressPlugin {
    private options;
    private static options;
    constructor(options: AddressPluginOptions);
    static init(options?: AddressPluginOptions): Type<AddressPlugin>;
}
