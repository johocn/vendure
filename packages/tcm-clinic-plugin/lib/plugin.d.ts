import { Type } from '@nestjs/common';
import { TcmClinicPluginOptions } from './types';
export declare class TcmClinicPlugin {
    static options: TcmClinicPluginOptions;
    static init(options?: TcmClinicPluginOptions): Type<TcmClinicPlugin>;
}
