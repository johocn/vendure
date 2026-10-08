import { Type } from '@nestjs/common';
import { InstallmentPluginOptions } from './types';
export declare class InstallmentPlugin {
    private static options;
    static init(options?: InstallmentPluginOptions): Type<InstallmentPlugin>;
}
