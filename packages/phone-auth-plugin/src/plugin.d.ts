import { Type } from '@nestjs/common';
import { PhoneAuthPluginOptions } from './types';
export declare class PhoneAuthPlugin {
    private options;
    private static options;
    constructor(options: PhoneAuthPluginOptions);
    static init(options: PhoneAuthPluginOptions): Type<PhoneAuthPlugin>;
}
