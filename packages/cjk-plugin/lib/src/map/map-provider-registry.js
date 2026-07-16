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
exports.MapProviderRegistry = void 0;
// e:\code\vendure\packages\cjk-plugin\src\map\map-provider-registry.ts
const common_1 = require("@nestjs/common");
const amap_provider_1 = require("./providers/amap-provider");
const tencent_provider_1 = require("./providers/tencent-provider");
const baidu_provider_1 = require("./providers/baidu-provider");
let MapProviderRegistry = class MapProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.register(new amap_provider_1.AmapProvider());
        this.register(new tencent_provider_1.TencentProvider());
        this.register(new baidu_provider_1.BaiduProvider());
    }
    register(provider) {
        this.providers.set(provider.name, provider);
    }
    /**
     * 获取 provider。若未注册抛出带 i18n key 的错误对象（由调用方翻译）。
     */
    get(name) {
        const provider = this.providers.get(name);
        if (!provider) {
            // 抛出带 i18n key 的错误，调用方用 translateError 翻译
            const err = new Error(name);
            err.i18nKey = 'MAP_PROVIDER_NOT_REGISTERED';
            err.i18nVars = { provider: name };
            throw err;
        }
        return provider;
    }
};
exports.MapProviderRegistry = MapProviderRegistry;
exports.MapProviderRegistry = MapProviderRegistry = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MapProviderRegistry);
//# sourceMappingURL=map-provider-registry.js.map