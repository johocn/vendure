import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { VoucherPluginOptions } from './voucher.options';
import { VoucherService } from './voucher.service';
export declare class VoucherPlugin implements OnApplicationBootstrap {
    private service;
    private eventBus;
    private static options;
    constructor(service: VoucherService, eventBus: EventBus);
    static init(options?: VoucherPluginOptions): typeof VoucherPlugin;
    onApplicationBootstrap(): void;
}
