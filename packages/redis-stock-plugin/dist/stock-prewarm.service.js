"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockPrewarmService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const stock_reserve_service_1 = require("./stock-reserve.service");
let StockPrewarmService = class StockPrewarmService {
    constructor(stockReserveService) {
        this.stockReserveService = stockReserveService;
    }
    async prewarm(key, stock) {
        if (!this.stockReserveService.isAvailable)
            return;
        const fullKey = `${constants_1.STOCK_KEY_PREFIX}${key}`;
        const redis = this.stockReserveService.redis;
        if (!redis)
            return;
        await redis.set(fullKey, stock);
        core_1.Logger.info(`Prewarmed stock key ${fullKey} with ${stock}`, constants_1.loggerCtx);
    }
    async removePrewarm(key) {
        if (!this.stockReserveService.isAvailable)
            return;
        const fullKey = `${constants_1.STOCK_KEY_PREFIX}${key}`;
        const redis = this.stockReserveService.redis;
        if (!redis)
            return;
        await redis.del(fullKey);
        core_1.Logger.info(`Removed stock key ${fullKey}`, constants_1.loggerCtx);
    }
};
exports.StockPrewarmService = StockPrewarmService;
exports.StockPrewarmService = StockPrewarmService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stock_reserve_service_1.StockReserveService])
], StockPrewarmService);
