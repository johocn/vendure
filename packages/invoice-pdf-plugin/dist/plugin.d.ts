import { Type } from '@nestjs/common';
import { InvoicePdfPluginOptions } from './types';
export declare class InvoicePdfPlugin {
    private options;
    private static options;
    constructor(options: InvoicePdfPluginOptions);
    static init(options?: InvoicePdfPluginOptions): Type<InvoicePdfPlugin>;
}
