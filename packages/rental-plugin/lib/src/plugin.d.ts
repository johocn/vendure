import { Type } from '@nestjs/common';
import { RentalPluginOptions } from './types';
export declare class RentalPlugin {
    private static options;
    static init(options?: RentalPluginOptions): Type<RentalPlugin>;
}
