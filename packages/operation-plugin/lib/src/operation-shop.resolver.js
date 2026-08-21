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
exports.OperationShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const operation_item_entity_1 = require("./operation-item.entity");
const operation_service_1 = require("./operation.service");
let OperationShopResolver = class OperationShopResolver {
    constructor(operationService) {
        this.operationService = operationService;
    }
    async operationSections(ctx) {
        const sections = await this.operationService.listEnabled(ctx);
        await this.operationService.resolveTargets(ctx, sections);
        return sections;
    }
    async operationSection(ctx, code) {
        const section = await this.operationService.getEnabledByCode(ctx, code);
        if (!section) {
            return null;
        }
        await this.operationService.resolveTargets(ctx, [section]);
        return section;
    }
    async product(_ctx, item) {
        var _a;
        return (_a = item.__product) !== null && _a !== void 0 ? _a : null;
    }
    async imageUrl(_ctx, item) {
        var _a;
        return (_a = item.__imageUrl) !== null && _a !== void 0 ? _a : null;
    }
};
exports.OperationShopResolver = OperationShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], OperationShopResolver.prototype, "operationSections", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], OperationShopResolver.prototype, "operationSection", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, operation_item_entity_1.OperationItem]),
    __metadata("design:returntype", Promise)
], OperationShopResolver.prototype, "product", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, operation_item_entity_1.OperationItem]),
    __metadata("design:returntype", Promise)
], OperationShopResolver.prototype, "imageUrl", null);
exports.OperationShopResolver = OperationShopResolver = __decorate([
    (0, graphql_1.Resolver)('OperationItem'),
    __metadata("design:paramtypes", [operation_service_1.OperationService])
], OperationShopResolver);
//# sourceMappingURL=operation-shop.resolver.js.map