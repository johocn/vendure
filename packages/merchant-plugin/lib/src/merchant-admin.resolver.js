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
var MerchantStoreFieldResolver_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerchantStoreFieldResolver = exports.MerchantFieldResolver = exports.MerchantAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const localize_1 = require("./localize");
const merchant_entity_1 = require("./merchant.entity");
const merchant_store_entity_1 = require("./merchant-store.entity");
const merchant_store_service_1 = require("./merchant-store.service");
/**
 * 商户/门店后台 API：读写商户主数据、门店、租户认领关系与门店员工。
 * 权限沿用订单更新权限（Permission.UpdateOrder），与既有运营插件保持一致。
 */
let MerchantAdminResolver = class MerchantAdminResolver {
    constructor(merchantStoreService) {
        this.merchantStoreService = merchantStoreService;
    }
    async merchants(ctx, options) {
        return this.merchantStoreService.listMerchants(ctx, options !== null && options !== void 0 ? options : {});
    }
    async merchant(ctx, id) {
        return this.merchantStoreService.getMerchant(ctx, id);
    }
    async merchantStores(ctx, options) {
        return this.merchantStoreService.listStores(ctx, options !== null && options !== void 0 ? options : {});
    }
    async merchantStore(ctx, id) {
        return this.merchantStoreService.getStore(ctx, id);
    }
    async merchantStoreClaims(ctx, storeId) {
        return this.merchantStoreService.listClaims(ctx, storeId);
    }
    async merchantStoreStaff(ctx, storeId) {
        return this.merchantStoreService.listStoreStaff(ctx, storeId);
    }
    async createMerchant(ctx, input) {
        return this.merchantStoreService.createMerchant(ctx, input);
    }
    async updateMerchant(ctx, input) {
        return this.merchantStoreService.updateMerchant(ctx, input);
    }
    async createMerchantStore(ctx, input) {
        return this.merchantStoreService.createStore(ctx, input);
    }
    async updateMerchantStore(ctx, input) {
        return this.merchantStoreService.updateStore(ctx, input);
    }
    async claimMerchantStore(ctx, storeId, channelId, role, contractNo) {
        return this.merchantStoreService.claimStore(ctx, { storeId, channelId, role, contractNo });
    }
    async revokeMerchantStoreClaim(ctx, storeId, channelId) {
        return this.merchantStoreService.revokeClaim(ctx, storeId, channelId);
    }
    async upsertMerchantStoreStaff(ctx, input) {
        if ((input === null || input === void 0 ? void 0 : input.storeId) == null || (input === null || input === void 0 ? void 0 : input.userId) == null) {
            throw new core_1.UserInputError('门店与后台用户不能为空');
        }
        return this.merchantStoreService.upsertStaff(ctx, input);
    }
};
exports.MerchantAdminResolver = MerchantAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "merchants", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "merchant", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('options', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "merchantStores", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "merchantStore", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "merchantStoreClaims", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "merchantStoreStaff", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "createMerchant", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "updateMerchant", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "createMerchantStore", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "updateMerchantStore", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('storeId')),
    __param(2, (0, graphql_1.Args)('channelId')),
    __param(3, (0, graphql_1.Args)('role', { nullable: true })),
    __param(4, (0, graphql_1.Args)('contractNo', { nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "claimMerchantStore", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('storeId')),
    __param(2, (0, graphql_1.Args)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "revokeMerchantStoreClaim", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], MerchantAdminResolver.prototype, "upsertMerchantStoreStaff", null);
exports.MerchantAdminResolver = MerchantAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [merchant_store_service_1.MerchantStoreService])
], MerchantAdminResolver);
/** Merchant.name / intro 的本地化输出解析 */
let MerchantFieldResolver = class MerchantFieldResolver {
    name(merchant, ctx) {
        return (0, localize_1.localizeText)(merchant.name, ctx.languageCode, '');
    }
    intro(merchant, ctx) {
        if (merchant.intro == null) {
            return null;
        }
        return (0, localize_1.localizeText)(merchant.intro, ctx.languageCode, '') || null;
    }
};
exports.MerchantFieldResolver = MerchantFieldResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_entity_1.Merchant, core_1.RequestContext]),
    __metadata("design:returntype", String)
], MerchantFieldResolver.prototype, "name", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_entity_1.Merchant, core_1.RequestContext]),
    __metadata("design:returntype", Object)
], MerchantFieldResolver.prototype, "intro", null);
exports.MerchantFieldResolver = MerchantFieldResolver = __decorate([
    (0, graphql_1.Resolver)('Merchant')
], MerchantFieldResolver);
/** MerchantStore.name / notice 的本地化输出解析，simple-json 字段统一序列化为 JSON 字符串 */
let MerchantStoreFieldResolver = MerchantStoreFieldResolver_1 = class MerchantStoreFieldResolver {
    name(store, ctx) {
        return (0, localize_1.localizeText)(store.name, ctx.languageCode, '');
    }
    notice(store, ctx) {
        if (store.notice == null) {
            return null;
        }
        return (0, localize_1.localizeText)(store.notice, ctx.languageCode, '') || null;
    }
    businessHours(store) {
        return MerchantStoreFieldResolver_1.jsonText(store.businessHours);
    }
    specialDates(store) {
        return MerchantStoreFieldResolver_1.jsonText(store.specialDates);
    }
    holidayPlan(store) {
        return MerchantStoreFieldResolver_1.jsonText(store.holidayPlan);
    }
    externalIds(store) {
        return MerchantStoreFieldResolver_1.jsonText(store.externalIds);
    }
    static jsonText(value) {
        if (value == null) {
            return null;
        }
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
};
exports.MerchantStoreFieldResolver = MerchantStoreFieldResolver;
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_store_entity_1.MerchantStore, core_1.RequestContext]),
    __metadata("design:returntype", String)
], MerchantStoreFieldResolver.prototype, "name", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __param(1, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_store_entity_1.MerchantStore, core_1.RequestContext]),
    __metadata("design:returntype", Object)
], MerchantStoreFieldResolver.prototype, "notice", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_store_entity_1.MerchantStore]),
    __metadata("design:returntype", Object)
], MerchantStoreFieldResolver.prototype, "businessHours", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_store_entity_1.MerchantStore]),
    __metadata("design:returntype", Object)
], MerchantStoreFieldResolver.prototype, "specialDates", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_store_entity_1.MerchantStore]),
    __metadata("design:returntype", Object)
], MerchantStoreFieldResolver.prototype, "holidayPlan", null);
__decorate([
    (0, graphql_1.ResolveField)(),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [merchant_store_entity_1.MerchantStore]),
    __metadata("design:returntype", Object)
], MerchantStoreFieldResolver.prototype, "externalIds", null);
exports.MerchantStoreFieldResolver = MerchantStoreFieldResolver = MerchantStoreFieldResolver_1 = __decorate([
    (0, graphql_1.Resolver)('MerchantStore')
], MerchantStoreFieldResolver);
//# sourceMappingURL=merchant-admin.resolver.js.map