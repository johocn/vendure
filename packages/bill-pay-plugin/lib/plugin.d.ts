import { Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BillPayService } from './bill-pay.service';
export declare class BillPayPlugin {
    private billPayService;
    private moduleRef;
    private injector;
    constructor(billPayService: BillPayService, moduleRef: ModuleRef);
    static init(): Type<BillPayPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
