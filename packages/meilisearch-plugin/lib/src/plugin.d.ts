import { Type } from '@nestjs/common';
import { MeiliService } from './meili.service';
import { MeiliPluginOptions } from './types';
export declare class MeiliSearchPlugin {
    private options;
    private meiliService;
    static options: MeiliPluginOptions;
    constructor(options: MeiliPluginOptions, meiliService: MeiliService);
    static init(options: MeiliPluginOptions): Type<MeiliSearchPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
