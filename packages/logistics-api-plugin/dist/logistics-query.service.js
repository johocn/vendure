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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsQueryService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = __importDefault(require("crypto"));
let LogisticsQueryService = class LogisticsQueryService {
    constructor(channelService) {
        this.channelService = channelService;
        this.cache = new Map();
    }
    async queryTracking(ctx, carrierCode, trackingNumber) {
        var _a;
        const { customer, key } = await this.getApiConfig(ctx);
        const cacheKey = `${carrierCode}:${trackingNumber}`;
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const param = JSON.stringify({
            com: carrierCode,
            num: trackingNumber,
        });
        const sign = crypto_1.default
            .createHash('md5')
            .update(param + key + customer)
            .digest('hex')
            .toUpperCase();
        const response = await fetch('https://poll.kuaidi100.com/poll/query.do', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `customer=${customer}&sign=${sign}&param=${encodeURIComponent(param)}`,
        });
        const data = await response.json();
        const traces = ((_a = data.data) !== null && _a !== void 0 ? _a : []).map((item) => ({
            time: item.ftime || item.time,
            status: item.status || '',
            description: item.context || '',
        }));
        const result = {
            carrierCode: data.com || carrierCode,
            trackingNumber: data.nu || trackingNumber,
            traces,
        };
        this.setToCache(cacheKey, result);
        return result;
    }
    async detectCarrier(ctx, trackingNumber) {
        const { key } = await this.getApiConfig(ctx);
        const response = await fetch(`https://auto.kuaidi100.com/autonumber/auto?num=${trackingNumber}&key=${key}`);
        const data = await response.json();
        return (data !== null && data !== void 0 ? data : []).map((item) => ({
            code: item.comCode,
            name: item.comCode,
        }));
    }
    async getApiConfig(ctx) {
        const channel = await this.channelService.findOne(ctx, ctx.channelId);
        const ccf = channel === null || channel === void 0 ? void 0 : channel.customFields;
        return {
            customer: (ccf === null || ccf === void 0 ? void 0 : ccf.kuaidi100Customer) || '',
            key: (ccf === null || ccf === void 0 ? void 0 : ccf.kuaidi100Key) || '',
        };
    }
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    setToCache(key, data, ttlMinutes = 30) {
        this.cache.set(key, {
            data,
            expires: Date.now() + ttlMinutes * 60 * 1000,
        });
    }
};
exports.LogisticsQueryService = LogisticsQueryService;
exports.LogisticsQueryService = LogisticsQueryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], LogisticsQueryService);
