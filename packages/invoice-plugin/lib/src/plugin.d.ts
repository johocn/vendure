import { Type } from '@nestjs/common';
import { InvoicePluginOptions } from './types';
export declare class InvoicePlugin {
    private options;
    private static options;
    constructor(options: InvoicePluginOptions);
    static init(options?: InvoicePluginOptions): Type<InvoicePlugin>;
}
