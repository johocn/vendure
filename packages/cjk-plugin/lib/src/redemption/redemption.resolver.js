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
exports.RedemptionAdminResolver = exports.RedemptionShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const redemption_code_service_1 = require("./redemption-code.service");
const redemption_crypto_1 = require("./redemption-crypto");
const ERR_NOT_FOUND = 'redemption.error.not_found';
let RedemptionShopResolver = class RedemptionShopResolver {
    constructor(redemptionCodeService, orderService, configService) {
        this.redemptionCodeService = redemptionCodeService;
        this.orderService = orderService;
        this.configService = configService;
    }
    async orderRedemptionCode(ctx, input) {
        var _a;
        const order = (await this.orderService.findOneByCode(ctx, input.orderCode));
        let canAccess = false;
        if (order) {
            if (input.phone) {
                const cf = (_a = order.customFields) !== null && _a !== void 0 ? _a : {};
                canAccess = cf.contactPhone === input.phone;
            }
            else {
                canAccess = await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order);
            }
        }
        if (!order || !canAccess) {
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        }
        const r = await this.redemptionCodeService.getWithQr(ctx, order.id, order.code);
        return {
            redemptionCode: r.code,
            qrPayload: r.qrPayload,
            barcodePayload: r.barcode,
            claimed: r.claimed,
            canAccess: true,
            status: r.status,
            expiresAt: r.expiresAt,
            reissueable: r.reissueable,
            version: r.version,
        };
    }
};
exports.RedemptionShopResolver = RedemptionShopResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('input')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], RedemptionShopResolver.prototype, "orderRedemptionCode", null);
exports.RedemptionShopResolver = RedemptionShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [redemption_code_service_1.RedemptionCodeService,
        core_1.OrderService,
        core_1.ConfigService])
], RedemptionShopResolver);
let RedemptionAdminResolver = class RedemptionAdminResolver {
    constructor(redemptionCodeService, orderService, entityHydrator) {
        this.redemptionCodeService = redemptionCodeService;
        this.orderService = orderService;
        this.entityHydrator = entityHydrator;
    }
    async redemptionLookup(ctx, code) {
        var _a, _b, _c, _d;
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order) {
            return { order: null, claimed: false, claimedAt: null, status: 'active', expiresAt: null, version: 1, reissueable: false };
        }
        // lookupByCode 经 queryBuilder 取 order 未加载 lines，Vendure hydrator 对
        // 未加载 relation 字段访问 totalQuantity 会抛错，故先灌注 lines 再读 totalQuantity。
        await this.entityHydrator.hydrate(ctx, order, { relations: ['lines'] });
        const cf = (_a = order.customFields) !== null && _a !== void 0 ? _a : {};
        const claimed = !!cf.redeemClaimed;
        const expiresAt = (_b = cf.redeemExpiresAt) !== null && _b !== void 0 ? _b : null;
        const version = Number(cf.redeemVersion) || 1;
        const status = (0, redemption_crypto_1.computeRedemptionStatus)(claimed, expiresAt, new Date(), 24);
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed,
            claimedAt: (_c = cf.redeemClaimedAt) !== null && _c !== void 0 ? _c : null,
            status,
            expiresAt: (_d = expiresAt !== null && expiresAt !== void 0 ? expiresAt : cf.redeemExpiresAt) !== null && _d !== void 0 ? _d : null,
            version,
            reissueable: !claimed,
        };
    }
    async redemptionClaim(ctx, code) {
        var _a, _b, _c;
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order)
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        // 同 redemptionLookup：先灌注 lines 再读 totalQuantity，避免未加载 relation 访问抛错。
        await this.entityHydrator.hydrate(ctx, order, { relations: ['lines'] });
        // lookupByCode 已限当前租户 Channel，核销复用同一检索保持租户隔离
        const result = await this.redemptionCodeService.claim(ctx, order.id);
        const cf = (_a = order.customFields) !== null && _a !== void 0 ? _a : {};
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed: true,
            claimedAt: (_c = (_b = result.claimedAt) !== null && _b !== void 0 ? _b : cf.redeemClaimedAt) !== null && _c !== void 0 ? _c : null,
            message: result.already ? 'already' : 'ok',
        };
    }
    async redemptionReissue(ctx, code) {
        const order = await this.redemptionCodeService.lookupByCode(ctx, code);
        if (!order)
            throw new core_1.UserInputError(ERR_NOT_FOUND);
        const result = await this.redemptionCodeService.reissue(ctx, order.id);
        return {
            order: {
                id: order.id,
                code: order.code,
                state: order.state,
                totalWithTax: order.totalWithTax,
                currencyCode: order.currencyCode,
                totalQuantity: order.totalQuantity,
            },
            claimed: result.claimed,
            claimedAt: null,
            message: 'reissued',
            status: result.status,
            expiresAt: result.expiresAt,
            version: result.version,
        };
    }
};
exports.RedemptionAdminResolver = RedemptionAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], RedemptionAdminResolver.prototype, "redemptionLookup", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], RedemptionAdminResolver.prototype, "redemptionClaim", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, String]),
    __metadata("design:returntype", Promise)
], RedemptionAdminResolver.prototype, "redemptionReissue", null);
exports.RedemptionAdminResolver = RedemptionAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [redemption_code_service_1.RedemptionCodeService,
        core_1.OrderService,
        core_1.EntityHydrator])
], RedemptionAdminResolver);
//# sourceMappingURL=redemption.resolver.js.map