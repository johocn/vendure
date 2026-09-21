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
exports.DeliveryCapabilityResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const delivery_facet_service_1 = require("./delivery-facet.service");
const shipping_profile_service_1 = require("./shipping-profile.service");
/**
 * 配送能力查询（shop-api）。
 * modes/bothSupported 由配送档案派生（唯一真源），与 facet 索引无关；
 * facetValueIds 为可选的「服务端筛选入口」，facet 尚未同步时为 null（C 端据此降级为不过滤）。
 */
let DeliveryCapabilityResolver = class DeliveryCapabilityResolver {
    constructor(shippingProfileService, deliveryFacetService) {
        this.shippingProfileService = shippingProfileService;
        this.deliveryFacetService = deliveryFacetService;
    }
    async channelDeliveryCapability(ctx) {
        const cap = await this.shippingProfileService.getChannelDeliveryCapability(ctx);
        return {
            modes: cap.modes,
            bothSupported: cap.bothSupported,
            source: cap.source,
            // facet 同步失败时返回 null，C 端据此降级为「不过滤」，不影响首页可用性
            facetValueIds: await this.deliveryFacetService.ensureFacet(ctx).catch((e) => {
                var _a;
                core_1.Logger.warn(`配送 facet 索引不可用：${(_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e}`, constants_1.loggerCtx);
                return null;
            }),
        };
    }
    /** 单品/多品派生能力（后台商品表单「只读展示」用） */
    async variantDeliveryModes(ctx, variantIds) {
        const map = await this.shippingProfileService.getVariantDeliveryCapabilities(ctx, variantIds);
        return [...map.entries()].map(([variantId, cap]) => ({ variantId, modes: cap.modes }));
    }
};
exports.DeliveryCapabilityResolver = DeliveryCapabilityResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], DeliveryCapabilityResolver.prototype, "channelDeliveryCapability", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.Public),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)('variantIds')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Array]),
    __metadata("design:returntype", Promise)
], DeliveryCapabilityResolver.prototype, "variantDeliveryModes", null);
exports.DeliveryCapabilityResolver = DeliveryCapabilityResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [shipping_profile_service_1.ShippingProfileService,
        delivery_facet_service_1.DeliveryFacetService])
], DeliveryCapabilityResolver);
//# sourceMappingURL=delivery-capability.resolver.js.map