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
exports.RiderShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const campus_config_service_1 = require("./campus-config.service");
const rider_service_1 = require("./rider.service");
let RiderShopResolver = class RiderShopResolver {
    constructor(riderService, configService) {
        this.riderService = riderService;
        this.configService = configService;
    }
    /** 需登录：service 内部校验当前顾客，未登录抛 ForbiddenError。 */
    async applyRider(ctx, realName, studentNo, campus, idImg) {
        return this.riderService.applyRider(ctx, { realName, studentNo, campus, idImg });
    }
    async myRiderProfile(ctx) {
        return this.riderService.myRiderProfile(ctx);
    }
    // 公开只读：C 端选楼用
    async campusZones(ctx) {
        return this.configService.listZones(ctx);
    }
    async campusBuildings(ctx, zoneId) {
        return this.configService.listBuildings(zoneId != null ? Number(zoneId) : undefined);
    }
};
exports.RiderShopResolver = RiderShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('realName')),
    __param(2, (0, graphql_1.Args)('studentNo')),
    __param(3, (0, graphql_1.Args)('campus')),
    __param(4, (0, graphql_1.Args)('idImg', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, String, String, String]),
    __metadata("design:returntype", Promise)
], RiderShopResolver.prototype, "applyRider", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], RiderShopResolver.prototype, "myRiderProfile", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], RiderShopResolver.prototype, "campusZones", null);
__decorate([
    (0, graphql_1.Query)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'zoneId', nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], RiderShopResolver.prototype, "campusBuildings", null);
exports.RiderShopResolver = RiderShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [rider_service_1.RiderService, campus_config_service_1.CampusConfigService])
], RiderShopResolver);
//# sourceMappingURL=rider-shop.resolver.js.map