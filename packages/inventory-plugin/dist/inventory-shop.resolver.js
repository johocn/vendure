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
exports.InventoryShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const inventory_service_1 = require("./inventory.service");
/**
 * 多库库存展示 Shop API：
 * 返回某商品在「各仓库/门店」的逐仓可售库存 + 与下单定位的距离，按距离升序。
 */
let InventoryShopResolver = class InventoryShopResolver {
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    async variantNearbyStock(ctx, productId, variantId, lat, lng, city) {
        const rows = await this.inventoryService.findNearbyStock(ctx, {
            productId,
            variantId,
            lat,
            lng,
            city,
        });
        return rows.map(r => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                distanceKm: r.distanceKm,
                location: {
                    id: r.location.id,
                    name: r.location.name,
                    description: r.location.description,
                    lat: (_b = (_a = r.location.customFields) === null || _a === void 0 ? void 0 : _a.lat) !== null && _b !== void 0 ? _b : null,
                    lng: (_d = (_c = r.location.customFields) === null || _c === void 0 ? void 0 : _c.lng) !== null && _d !== void 0 ? _d : null,
                    serviceCities: (_f = (_e = r.location.customFields) === null || _e === void 0 ? void 0 : _e.serviceCities) !== null && _f !== void 0 ? _f : null,
                },
                variants: r.variants,
            });
        });
    }
};
exports.InventoryShopResolver = InventoryShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)({ name: 'productId', type: () => String })),
    __param(2, (0, graphql_1.Args)({ name: 'variantId', type: () => String, nullable: true })),
    __param(3, (0, graphql_1.Args)({ name: 'lat', type: () => Number, nullable: true })),
    __param(4, (0, graphql_1.Args)({ name: 'lng', type: () => Number, nullable: true })),
    __param(5, (0, graphql_1.Args)({ name: 'city', type: () => String, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, Number, Number, String]),
    __metadata("design:returntype", Promise)
], InventoryShopResolver.prototype, "variantNearbyStock", null);
exports.InventoryShopResolver = InventoryShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryShopResolver);
