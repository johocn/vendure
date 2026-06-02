import { Type } from '@nestjs/common';
import { AlipayPluginOptions } from './types';
export declare class AlipayPlugin {
    private options;
    private static options;
    constructor(options: AlipayPluginOptions);
    static init(options: AlipayPluginOptions): Type<AlipayPlugin>;
}
