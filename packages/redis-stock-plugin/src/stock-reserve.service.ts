import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Logger } from '@vendure/core';
import Redis from 'ioredis';

import { loggerCtx, STOCK_KEY_PREFIX } from './constants';
import { RedisStockPluginOptions } from './types';

@Injectable()
export class StockReserveService implements OnModuleDestroy {
    private redis: Redis | null = null;
    private keyPrefix: string = STOCK_KEY_PREFIX;

    async init(options: RedisStockPluginOptions): Promise<void> {
        if (!options.redisUrl) {
            Logger.warn('No redisUrl configured, Redis stock reservation disabled', loggerCtx);
            return;
        }
        this.keyPrefix = options.keyPrefix ?? STOCK_KEY_PREFIX;
        this.redis = new Redis(options.redisUrl);
        this.redis.on('error', (err) => {
            Logger.error(`Redis connection error: ${err.message}`, loggerCtx);
        });
        await this.redis.ping();
        Logger.info('RedisStockPlugin connected to Redis', loggerCtx);
    }

    get isAvailable(): boolean {
        return this.redis !== null;
    }

    async reserveStock(key: string, quantity: number): Promise<number> {
        if (!this.redis) return 0;
        const fullKey = `${this.keyPrefix}${key}`;
        const remaining = await this.redis.decrby(fullKey, quantity);
        if (remaining < 0) {
            await this.redis.incrby(fullKey, quantity);
            return remaining;
        }
        return remaining;
    }

    async releaseStock(key: string, quantity: number): Promise<number> {
        if (!this.redis) return 0;
        const fullKey = `${this.keyPrefix}${key}`;
        return this.redis.incrby(fullKey, quantity);
    }

    async getStock(key: string): Promise<number | null> {
        if (!this.redis) return null;
        const fullKey = `${this.keyPrefix}${key}`;
        const val = await this.redis.get(fullKey);
        return val !== null ? parseInt(val, 10) : null;
    }

    onModuleDestroy() {
        if (this.redis) {
            this.redis.disconnect();
        }
    }
}
