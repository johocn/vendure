import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InvoicePluginOptions } from './types';
import { InvoiceService } from './invoice.service';
export declare class InvoicePlugin implements OnApplicationBootstrap {
    private options;
    private invoiceService;
    private moduleRef;
    private static options;
    private injector;
    constructor(options: InvoicePluginOptions, invoiceService: InvoiceService, moduleRef: ModuleRef);
    static init(options?: InvoicePluginOptions): Type<InvoicePlugin>;
    onApplicationBootstrap(): Promise<void>;
}
