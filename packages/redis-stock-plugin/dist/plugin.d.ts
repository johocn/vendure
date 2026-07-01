import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { StockReserveService } from './stock-reserve.service';
import { RedisStockPluginOptions } from './types';
export declare class RedisStockPlugin implements OnApplicationBootstrap {
    private options;
    private stockReserveService;
    private static options;
    constructor(options: RedisStockPluginOptions, stockReserveService: StockReserveService);
    static init(options?: RedisStockPluginOptions): Type<RedisStockPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
