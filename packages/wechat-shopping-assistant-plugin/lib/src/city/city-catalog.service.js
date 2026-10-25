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
exports.CityCatalogService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const city_catalog_1 = require("./city-catalog");
const loggerCtx = 'WechatAssistantCityCatalog';
const CACHE_TTL_MS = 5 * 60000;
let CityCatalogService = class CityCatalogService {
    constructor(connection) {
        this.connection = connection;
        this.cache = null;
    }
    async getIndex(ctx) {
        if (this.cache && this.cache.expiresAt > Date.now())
            return this.cache.index;
        // 用 rawConnection 绕过 ChannelAware 过滤：目录需要跨渠道全量（ctx 通道过滤会漏掉其他租户）
        const channels = await this.connection.rawConnection.getRepository(core_1.Channel).find();
        const channelLikes = channels.map(ch => {
            var _a, _b, _c;
            const cf = ((_a = ch.customFields) !== null && _a !== void 0 ? _a : {});
            return {
                id: String(ch.id),
                code: ch.code,
                token: ch.token,
                name: String((_b = cf.shopName) !== null && _b !== void 0 ? _b : ch.code),
                servingCities: Array.isArray(cf.servingCities) ? cf.servingCities.map(String) : [],
                minOrderAmount: Number((_c = cf.minOrderAmount) !== null && _c !== void 0 ? _c : 0) || 0,
                deliveryMinutes: cf.deliveryMinutes != null ? Number(cf.deliveryMinutes) : null,
            };
        });
        const index = (0, city_catalog_1.buildCityIndex)(channelLikes);
        this.cache = { index, expiresAt: Date.now() + CACHE_TTL_MS };
        common_1.Logger.log(`City catalog built: cities=${index.byCity.size} all=${index.allChannels.length}`, loggerCtx);
        return index;
    }
    /** 渠道字段变更后立即失效（后台保存时调用） */
    invalidate() {
        this.cache = null;
    }
};
exports.CityCatalogService = CityCatalogService;
exports.CityCatalogService = CityCatalogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], CityCatalogService);
//# sourceMappingURL=city-catalog.service.js.map