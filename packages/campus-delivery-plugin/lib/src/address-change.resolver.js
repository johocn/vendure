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
exports.AddressChangeAdminResolver = exports.AddressChangeShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const address_change_service_1 = require("./address-change.service");
const permissions_1 = require("./permissions");
/** 顾客端：订单详情「修改地址」（取货前可改，可跨分区，差额记台账） */
let AddressChangeShopResolver = class AddressChangeShopResolver {
    constructor(service) {
        this.service = service;
    }
    campusChangeDeliveryAddress(ctx, orderId, zoneId, buildingId, detail) {
        return this.service.changeByCustomer(ctx, { orderId, zoneId, buildingId, detail });
    }
    /** 顾客端：本单最近一次改址差额状态（待补/待退/已结清） */
    campusMyAddressChange(ctx, orderId) {
        return this.service.myLatest(ctx, orderId);
    }
};
exports.AddressChangeShopResolver = AddressChangeShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('zoneId')),
    __param(3, (0, graphql_1.Args)('buildingId')),
    __param(4, (0, graphql_1.Args)({ name: 'detail', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Object, String]),
    __metadata("design:returntype", void 0)
], AddressChangeShopResolver.prototype, "campusChangeDeliveryAddress", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", void 0)
], AddressChangeShopResolver.prototype, "campusMyAddressChange", null);
exports.AddressChangeShopResolver = AddressChangeShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [address_change_service_1.AddressChangeService])
], AddressChangeShopResolver);
/** 运营端：改址台账查询/统计/结清 */
let AddressChangeAdminResolver = class AddressChangeAdminResolver {
    constructor(service) {
        this.service = service;
    }
    campusAddressChanges(ctx, status, skip, take) {
        return this.service.list(ctx, { status, skip, take });
    }
    campusAddressChangeStats(ctx) {
        return this.service.stats(ctx);
    }
    campusSettleAddressChange(ctx, id, action) {
        return this.service.settle(ctx, id, action);
    }
    /** 运营代客改址（取货后也可代改，必须填原因） */
    campusAdminChangeDeliveryAddress(ctx, orderId, zoneId, buildingId, detail, reason) {
        return this.service.adminChange(ctx, { orderId, zoneId, buildingId, detail, reason });
    }
    /** 改址差额试算（不写台账） */
    campusAdminQuoteAddressChange(ctx, orderId, zoneId) {
        return this.service.quote(ctx, orderId, zoneId);
    }
    /** 动态计价试算预览（当前供需 + 各分区加价拆解） */
    campusDynamicPricingPreview(ctx) {
        return this.service.dynamicPreview(ctx);
    }
};
exports.AddressChangeAdminResolver = AddressChangeAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'status', type: () => String, nullable: true })),
    __param(2, (0, graphql_1.Args)({ name: 'skip', type: () => Number, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'take', type: () => Number, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", void 0)
], AddressChangeAdminResolver.prototype, "campusAddressChanges", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", void 0)
], AddressChangeAdminResolver.prototype, "campusAddressChangeStats", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __param(2, (0, graphql_1.Args)('action')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, String]),
    __metadata("design:returntype", void 0)
], AddressChangeAdminResolver.prototype, "campusSettleAddressChange", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('zoneId')),
    __param(3, (0, graphql_1.Args)('buildingId')),
    __param(4, (0, graphql_1.Args)({ name: 'detail', type: () => String, nullable: true })),
    __param(5, (0, graphql_1.Args)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Object, Object, String]),
    __metadata("design:returntype", void 0)
], AddressChangeAdminResolver.prototype, "campusAdminChangeDeliveryAddress", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('orderId')),
    __param(2, (0, graphql_1.Args)('zoneId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", void 0)
], AddressChangeAdminResolver.prototype, "campusAdminQuoteAddressChange", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(permissions_1.CampusPermissions.CampusConfig),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", void 0)
], AddressChangeAdminResolver.prototype, "campusDynamicPricingPreview", null);
exports.AddressChangeAdminResolver = AddressChangeAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [address_change_service_1.AddressChangeService])
], AddressChangeAdminResolver);
//# sourceMappingURL=address-change.resolver.js.map