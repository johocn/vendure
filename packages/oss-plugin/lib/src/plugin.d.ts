import { Type } from '@nestjs/common';
import { OssPluginOptions } from './types';
export declare class OssPlugin {
    private options;
    private static options;
    constructor(options: OssPluginOptions);
    static init(options: OssPluginOptions): Type<OssPlugin>;
}
