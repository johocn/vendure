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
exports.PickupLocationShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const pickup_location_service_1 = require("./pickup-location.service");
const enterprise_customer_service_1 = require("./enterprise-customer/enterprise-customer.service");
let PickupLocationShopResolver = class PickupLocationShopResolver {
    constructor(pickupLocationService, employeeCustomerService) {
        this.pickupLocationService = pickupLocationService;
        this.employeeCustomerService = employeeCustomerService;
    }
    async pickupLocations(ctx, type, lat, lng) {
        const locations = type
            ? await this.pickupLocationService.findByType(ctx, type)
            : (await this.pickupLocationService.findAll(ctx)).items;
        if (lat != null && lng != null) {
            return this.pickupLocationService.sortByDistance(locations, lat, lng);
        }
        return locations;
    }
    async employeePickupLocations(ctx, lat, lng) {
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'disabled')
            return [];
        if (mode === 'loose') {
            const locations = await this.pickupLocationService.findByType(ctx, 'employee');
            if (lat != null && lng != null) {
                return this.pickupLocationService.sortByDistance(locations, lat, lng);
            }
            return locations;
        }
        // strict
        if (!ctx.activeUserId)
            return [];
        const bindings = await this.employeeCustomerService.findByCustomer(ctx, ctx.activeUserId);
        const locationIds = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
        const locations = await this.pickupLocationService.findByIds(ctx, locationIds);
        if (lat != null && lng != null) {
            return this.pickupLocationService.sortByDistance(locations, lat, lng);
        }
        return locations;
    }
};
exports.PickupLocationShopResolver = PickupLocationShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('type')),
    __param(2, (0, graphql_1.Args)('lat')),
    __param(3, (0, graphql_1.Args)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], PickupLocationShopResolver.prototype, "pickupLocations", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Owner),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('lat')),
    __param(2, (0, graphql_1.Args)('lng')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Number, Number]),
    __metadata("design:returntype", Promise)
], PickupLocationShopResolver.prototype, "employeePickupLocations", null);
exports.PickupLocationShopResolver = PickupLocationShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [pickup_location_service_1.PickupLocationService,
        enterprise_customer_service_1.EmployeeCustomerService])
], PickupLocationShopResolver);
//# sourceMappingURL=pickup-location-shop.resolver.js.map