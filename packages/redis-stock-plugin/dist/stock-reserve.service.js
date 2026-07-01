"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockReserveService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const ioredis_1 = __importDefault(require("ioredis"));
const constants_1 = require("./constants");
let StockReserveService = class StockReserveService {
    constructor() {
        this.redis = null;
        this.keyPrefix = constants_1.STOCK_KEY_PREFIX;
    }
    async init(options) {
        var _a;
        if (!options.redisUrl) {
            core_1.Logger.warn('No redisUrl configured, Redis stock reservation disabled', constants_1.loggerCtx);
            return;
        }
        this.keyPrefix = (_a = options.keyPrefix) !== null && _a !== void 0 ? _a : constants_1.STOCK_KEY_PREFIX;
        this.redis = new ioredis_1.default(options.redisUrl);
        this.redis.on('error', (err) => {
            core_1.Logger.error(`Redis connection error: ${err.message}`, constants_1.loggerCtx);
        });
        await this.redis.ping();
        core_1.Logger.info('RedisStockPlugin connected to Redis', constants_1.loggerCtx);
    }
    get isAvailable() {
        return this.redis !== null;
    }
    async reserveStock(key, quantity) {
        if (!this.redis)
            return 0;
        const fullKey = `${this.keyPrefix}${key}`;
        const remaining = await this.redis.decrby(fullKey, quantity);
        if (remaining < 0) {
            await this.redis.incrby(fullKey, quantity);
            return remaining;
        }
        return remaining;
    }
    async releaseStock(key, quantity) {
        if (!this.redis)
            return 0;
        const fullKey = `${this.keyPrefix}${key}`;
        return this.redis.incrby(fullKey, quantity);
    }
    async getStock(key) {
        if (!this.redis)
            return null;
        const fullKey = `${this.keyPrefix}${key}`;
        const val = await this.redis.get(fullKey);
        return val !== null ? parseInt(val, 10) : null;
    }
    onModuleDestroy() {
        if (this.redis) {
            this.redis.disconnect();
        }
    }
};
exports.StockReserveService = StockReserveService;
exports.StockReserveService = StockReserveService = __decorate([
    (0, common_1.Injectable)()
], StockReserveService);
