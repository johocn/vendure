import { OnModuleDestroy } from '@nestjs/common';
import { RedisStockPluginOptions } from './types';
export declare class StockReserveService implements OnModuleDestroy {
    private redis;
    private keyPrefix;
    init(options: RedisStockPluginOptions): Promise<void>;
    get isAvailable(): boolean;
    reserveStock(key: string, quantity: number): Promise<number>;
    releaseStock(key: string, quantity: number): Promise<number>;
    getStock(key: string): Promise<number | null>;
    onModuleDestroy(): void;
}
