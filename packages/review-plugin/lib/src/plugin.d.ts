import { Type } from '@nestjs/common';
import { ReviewPluginOptions } from './types';
export declare class ReviewPlugin {
    private options;
    private static options;
    constructor(options: ReviewPluginOptions);
    static init(options?: ReviewPluginOptions): Type<ReviewPlugin>;
}
