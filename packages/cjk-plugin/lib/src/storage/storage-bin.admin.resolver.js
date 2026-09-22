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
exports.StorageBinAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const storage_bin_service_1 = require("./storage-bin.service");
/** 库位/库区管理（三档开关共用同一套接口，差异只在前端门控） */
let StorageBinAdminResolver = class StorageBinAdminResolver {
    constructor(storageBinService) {
        this.storageBinService = storageBinService;
    }
    async storageZones(ctx, stockLocationId) {
        return this.storageBinService.zones(ctx, Number(stockLocationId));
    }
    async storageBins(ctx, args) {
        return this.storageBinService.bins(ctx, Number(args.stockLocationId), args.zoneId ? Number(args.zoneId) : null);
    }
    async variantBin(ctx, args) {
        return this.storageBinService.variantBin(ctx, Number(args.variantId), Number(args.stockLocationId));
    }
    async generateStandardBins(ctx, stockLocationId) {
        return this.storageBinService.generateStandard(ctx, Number(stockLocationId));
    }
    async bindVariantToBin(ctx, input) {
        return this.storageBinService.bind(ctx, {
            variantId: Number(input.variantId),
            stockLocationId: Number(input.stockLocationId),
            zoneId: Number(input.zoneId),
            binId: input.binId ? Number(input.binId) : null,
        });
    }
    async unbindVariantFromBin(ctx, args) {
        return this.storageBinService.unbind(ctx, Number(args.variantId), Number(args.stockLocationId));
    }
    async deleteStorageBin(ctx, id) {
        return this.storageBinService.deleteBin(ctx, id);
    }
};
exports.StorageBinAdminResolver = StorageBinAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('stockLocationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "storageZones", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "storageBins", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "variantBin", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('stockLocationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "generateStandardBins", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "bindVariantToBin", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "unbindVariantFromBin", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateCatalog),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], StorageBinAdminResolver.prototype, "deleteStorageBin", null);
exports.StorageBinAdminResolver = StorageBinAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [storage_bin_service_1.StorageBinService])
], StorageBinAdminResolver);
//# sourceMappingURL=storage-bin.admin.resolver.js.map