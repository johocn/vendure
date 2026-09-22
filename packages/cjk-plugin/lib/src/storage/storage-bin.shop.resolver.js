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
exports.StorageBinShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const storage_bin_service_1 = require("./storage-bin.service");
/** C 端只读：展示某 SKU 的库区/库位（三档差异由前端门控） */
let StorageBinShopResolver = class StorageBinShopResolver {
    constructor(storageBinService) {
        this.storageBinService = storageBinService;
    }
    async variantBin(ctx, args) {
        return this.storageBinService.variantBin(ctx, Number(args.variantId), Number(args.stockLocationId));
    }
    async storageZones(ctx, stockLocationId) {
        return this.storageBinService.zones(ctx, Number(stockLocationId));
    }
};
exports.StorageBinShopResolver = StorageBinShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinShopResolver.prototype, "variantBin", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('stockLocationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinShopResolver.prototype, "storageZones", null);
exports.StorageBinShopResolver = StorageBinShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [storage_bin_service_1.StorageBinService])
], StorageBinShopResolver);
//# sourceMappingURL=storage-bin.shop.resolver.js.map