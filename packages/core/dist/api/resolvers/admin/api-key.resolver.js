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
exports.ApiKeyResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const generated_types_1 = require("@vendure/common/lib/generated-types");
const __1 = require("../..");
const common_1 = require("../../../common");
const api_key_entity_1 = require("../../../entity/api-key/api-key.entity");
const api_key_service_1 = require("../../../service/services/api-key.service");
const allow_decorator_1 = require("../../decorators/allow.decorator");
const transaction_decorator_1 = require("../../decorators/transaction.decorator");
let ApiKeyResolver = class ApiKeyResolver {
    constructor(apiKeyService) {
        this.apiKeyService = apiKeyService;
    }
    async apiKey(ctx, { id }, relations) {
        return this.apiKeyService.findOne(ctx, id, relations);
    }
    async apiKeys(ctx, { options }, relations) {
        return this.apiKeyService.findAll(ctx, options, relations);
    }
    async createApiKey(ctx, { input }) {
        if (!ctx.activeUserId)
            throw new common_1.InternalServerError('error.active-user-does-not-have-sufficient-permissions');
        return this.apiKeyService.create(ctx, input, ctx.activeUserId);
    }
    async updateApiKey(ctx, { input }, relations) {
        return this.apiKeyService.update(ctx, input, relations);
    }
    async deleteApiKeys(ctx, { ids }) {
        return Promise.all(ids.map(id => this.apiKeyService.softDelete(ctx, id)));
    }
    async rotateApiKey(ctx, { id }) {
        return this.apiKeyService.rotate(ctx, id);
    }
};
exports.ApiKeyResolver = ApiKeyResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.ReadApiKey),
    __param(0, (0, __1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __param(2, (0, __1.Relations)(api_key_entity_1.ApiKey)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [__1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], ApiKeyResolver.prototype, "apiKey", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.ReadApiKey),
    __param(0, (0, __1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __param(2, (0, __1.Relations)(api_key_entity_1.ApiKey)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [__1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], ApiKeyResolver.prototype, "apiKeys", null);
__decorate([
    (0, transaction_decorator_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.CreateApiKey),
    __param(0, (0, __1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [__1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyResolver.prototype, "createApiKey", null);
__decorate([
    (0, transaction_decorator_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.UpdateApiKey),
    __param(0, (0, __1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __param(2, (0, __1.Relations)(api_key_entity_1.ApiKey)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [__1.RequestContext, Object, Array]),
    __metadata("design:returntype", Promise)
], ApiKeyResolver.prototype, "updateApiKey", null);
__decorate([
    (0, transaction_decorator_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.DeleteApiKey),
    __param(0, (0, __1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [__1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyResolver.prototype, "deleteApiKeys", null);
__decorate([
    (0, transaction_decorator_1.Transaction)(),
    (0, graphql_1.Mutation)(),
    (0, allow_decorator_1.Allow)(generated_types_1.Permission.UpdateApiKey),
    __param(0, (0, __1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [__1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyResolver.prototype, "rotateApiKey", null);
exports.ApiKeyResolver = ApiKeyResolver = __decorate([
    (0, graphql_1.Resolver)('ApiKey'),
    __metadata("design:paramtypes", [api_key_service_1.ApiKeyService])
], ApiKeyResolver);
//# sourceMappingURL=api-key.resolver.js.map