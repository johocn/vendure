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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const map_service_1 = require("./map.service");
let MapShopResolver = class MapShopResolver {
    constructor(mapService) {
        this.mapService = mapService;
    }
    async mapDistricts(ctx, parentAdcode) {
        return this.mapService.getDistricts(ctx, parentAdcode !== null && parentAdcode !== void 0 ? parentAdcode : null);
    }
    async reverseGeocode(ctx, lat, lng) {
        return this.mapService.reverseGeocode(ctx, lat, lng);
    }
    async mapSdkConfig(ctx) {
        // 供前端加载地图 SDK 定位；apiKey 由服务端下发，前端不硬编码
        return this.mapService.getSdkConfig(ctx);
    }
};
exports.MapShopResolver = MapShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('parentAdcode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], MapShopResolver.prototype, "mapDistricts", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('lat')),
    __param(2, (0, graphql_1.Args)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], MapShopResolver.prototype, "reverseGeocode", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], MapShopResolver.prototype, "mapSdkConfig", null);
exports.MapShopResolver = MapShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [map_service_1.MapService])
], MapShopResolver);
//# sourceMappingURL=map-shop.resolver.js.map