import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';

import { loggerCtx, STOCK_KEY_PREFIX } from './constants';
import { StockReserveService } from './stock-reserve.service';

@Injectable()
export class StockPrewarmService {
    constructor(private stockReserveService: StockReserveService) {}

    async prewarm(key: string, stock: number): Promise<void> {
        if (!this.stockReserveService.isAvailable) return;
        const fullKey = `${STOCK_KEY_PREFIX}${key}`;
        const redis = (this.stockReserveService as any).redis;
        if (!redis) return;
        await redis.set(fullKey, stock);
        Logger.info(`Prewarmed stock key ${fullKey} with ${stock}`, loggerCtx);
    }

    async removePrewarm(key: string): Promise<void> {
        if (!this.stockReserveService.isAvailable) return;
        const fullKey = `${STOCK_KEY_PREFIX}${key}`;
        const redis = (this.stockReserveService as any).redis;
        if (!redis) return;
        await redis.del(fullKey);
        Logger.info(`Removed stock key ${fullKey}`, loggerCtx);
    }
}
