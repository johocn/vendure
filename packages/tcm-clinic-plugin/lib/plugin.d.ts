import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TcmClinicPluginOptions } from './types';
export declare class TcmClinicPlugin implements OnApplicationBootstrap {
    private moduleRef?;
    static options: TcmClinicPluginOptions;
    constructor(moduleRef?: ModuleRef | undefined);
    static init(options?: TcmClinicPluginOptions): Type<TcmClinicPlugin>;
    /** 注册写路径馆归属拒绝的 i18n 文案（en / zh_Hans 双语） */
    onApplicationBootstrap(): Promise<void>;
}
