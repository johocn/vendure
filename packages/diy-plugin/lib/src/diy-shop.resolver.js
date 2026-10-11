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
exports.DiyShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const diy_shop_service_1 = require("./diy-shop.service");
let DiyShopResolver = class DiyShopResolver {
    constructor(service) {
        this.service = service;
    }
    async diyMaterials(ctx, filter) {
        return this.service.findShopMaterials(ctx, filter !== null && filter !== void 0 ? filter : {});
    }
    async diyShopTemplates(ctx) {
        return this.service.findShopTemplates(ctx);
    }
    async diyShopTemplate(ctx, code) {
        return this.service.findShopTemplateByCode(ctx, code);
    }
    async createDiyPlan(ctx, templateCode, spec, thumb) {
        return this.service.createDiyPlan(ctx, { templateCode, spec, thumb });
    }
    async myDiyPlans(ctx, status, skip, take) {
        return this.service.myDiyPlans(ctx, { status, skip, take });
    }
    async myDiyPlan(ctx, id) {
        return this.service.myDiyPlan(ctx, id);
    }
    async quoteDiyPlan(ctx, id) {
        return this.service.quoteDiyPlan(ctx, id);
    }
};
exports.DiyShopResolver = DiyShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('filter', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "diyMaterials", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "diyShopTemplates", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "diyShopTemplate", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('templateCode')),
    __param(2, (0, graphql_1.Args)('spec')),
    __param(3, (0, graphql_1.Args)('thumb', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Object, Object]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "createDiyPlan", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('status', { nullable: true })),
    __param(2, (0, graphql_1.Args)('skip', { nullable: true })),
    __param(3, (0, graphql_1.Args)('take', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String, Number, Number]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "myDiyPlans", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "myDiyPlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], DiyShopResolver.prototype, "quoteDiyPlan", null);
exports.DiyShopResolver = DiyShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [diy_shop_service_1.DiyShopService])
], DiyShopResolver);
//# sourceMappingURL=diy-shop.resolver.js.map