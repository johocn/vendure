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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryFacetService = exports.DELIVERY_FACET_CODE = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const shipping_profile_service_1 = require("./shipping-profile.service");
/** 派生配送能力所用的原生 facet code（一个 facet，两个 facet value） */
exports.DELIVERY_FACET_CODE = 'delivery-mode';
/** 能力 → facet value code（C 端按 code 取 id，再走 facetValueFilters 过滤） */
const DELIVERY_FACET_VALUE_CODES = {
    MAIL: 'mail',
    SELF_PICKUP: 'self-pickup',
};
const DELIVERY_FACET_VALUE_NAMES = {
    MAIL: '支持邮寄',
    SELF_PICKUP: '支持自提',
};
const DELIVERY_FACET_NAME = '配送方式';
const ALL_MODES = ['MAIL', 'SELF_PICKUP'];
/**
 * 把「配送能力派生」结果同步到 Vendure 原生 facet（ProductVariant.facetValues），
 * 使 C 端能用原生 search 的 facetValueFilters 做服务端过滤（totalItems / 分页正确）。
 *
 * 能力真源仍是 ShippingProfileMethod.mode（见 delivery-capability.ts），facet 只是它的索引副本。
 */
let DeliveryFacetService = class DeliveryFacetService {
    constructor(connection, facetService, facetValueService, channelService, productVariantService, shippingProfileService) {
        this.connection = connection;
        this.facetService = facetService;
        this.facetValueService = facetValueService;
        this.channelService = channelService;
        this.productVariantService = productVariantService;
        this.shippingProfileService = shippingProfileService;
        /** channelId → { MAIL: <facetValueId>, SELF_PICKUP: <facetValueId> }，避免读接口每次请求都查库 */
        this.facetCache = new Map();
    }
    /**
     * 幂等保证渠道内存在 facet 与两个 facet value，返回 { MAIL: id, SELF_PICKUP: id }。
     *
     * Facet / FacetValue 是 ChannelsAware：必须走 FacetService / FacetValueService（内部
     * assignToCurrentChannel）或 ChannelService.assignToChannels 才会分配渠道；直接
     * connection.getRepository(...).save() 不会分配，后续按渠道查询会查不到。
     */
    async ensureFacet(ctx) {
        var _a, _b;
        const channelId = Number(ctx.channelId);
        const cached = this.facetCache.get(channelId);
        if (cached) {
            return cached;
        }
        const repo = this.connection.getRepository(ctx, core_1.Facet);
        let facet = await repo.findOne({
            where: { code: exports.DELIVERY_FACET_CODE },
            relations: ['values'],
        });
        if (!facet) {
            const created = await this.facetService.create(ctx, {
                code: exports.DELIVERY_FACET_CODE,
                isPrivate: false,
                translations: [{ languageCode: ctx.languageCode, name: DELIVERY_FACET_NAME }],
            });
            facet =
                (_a = (await repo.findOne({ where: { id: created.id }, relations: ['values'] }))) !== null && _a !== void 0 ? _a : created;
        }
        // 已存在（可能由其它渠道先创建）时也要确保本渠道可用，
        // 否则 ProductVariantService.update 内部 findByIds 是按渠道查的，会静默丢掉这些值。
        await this.channelService.assignToChannels(ctx, core_1.Facet, facet.id, [ctx.channelId]);
        const existing = new Map();
        for (const value of (_b = facet.values) !== null && _b !== void 0 ? _b : []) {
            existing.set(value.code, value);
        }
        const out = {};
        for (const mode of ALL_MODES) {
            const code = DELIVERY_FACET_VALUE_CODES[mode];
            let value = existing.get(code);
            if (!value) {
                value = await this.facetValueService.create(ctx, facet, {
                    code,
                    translations: [{ languageCode: ctx.languageCode, name: DELIVERY_FACET_VALUE_NAMES[mode] }],
                });
            }
            await this.channelService.assignToChannels(ctx, core_1.FacetValue, value.id, [ctx.channelId]);
            out[mode] = String(value.id);
        }
        this.facetCache.set(channelId, out);
        return out;
    }
    /** 使某渠道的 facet 缓存失效（facet 被外部改动 / 重建时使用） */
    invalidateChannel(channelId) {
        this.facetCache.delete(Number(channelId));
    }
    /** 重建整个渠道的配送 facet 同步（档案方法配置 / 档案增删改 / 启停 / 租户默认 变更后调用） */
    async rebuildChannel(ctx, batchSize = 200) {
        this.invalidateChannel(ctx.channelId);
        const rows = await this.connection
            .getRepository(ctx, core_1.ProductVariant)
            .createQueryBuilder('v')
            .innerJoin('v.channels', 'c', 'c.id = :cid', { cid: ctx.channelId })
            .select('v.id', 'id')
            .where('v.deletedAt IS NULL')
            .getRawMany();
        const variantIds = rows.map(r => r.id);
        const facetIds = await this.ensureFacet(ctx);
        let updated = 0;
        for (let i = 0; i < variantIds.length; i += batchSize) {
            updated += await this.syncVariants(ctx, variantIds.slice(i, i + batchSize), facetIds);
        }
        core_1.Logger.info(`重建配送 facet：channel=${ctx.channelId} 扫描 ${variantIds.length} 个变体，更新 ${updated} 个`, constants_1.loggerCtx);
        return { scanned: variantIds.length, updated };
    }
    /**
     * 把指定变体的配送 facet 同步为派生结果（保留其它 facet），返回实际更新条数。
     * 变更检测：与当前集合一致则跳过，避免无谓的搜索索引更新。
     */
    async syncVariants(ctx, variantIds, facetIds) {
        if (variantIds.length === 0) {
            return 0;
        }
        const ids = facetIds !== null && facetIds !== void 0 ? facetIds : (await this.ensureFacet(ctx));
        const deliveryValueIds = new Set(Object.values(ids).map(String));
        const [caps, variants] = await Promise.all([
            this.shippingProfileService.getVariantDeliveryCapabilities(ctx, variantIds),
            this.connection
                .getRepository(ctx, core_1.ProductVariant)
                .createQueryBuilder('v')
                .leftJoinAndSelect('v.facetValues', 'fv')
                .where('v.id IN (:...ids)', { ids: variantIds.map(v => Number(v)) })
                .getMany(),
        ]);
        let updated = 0;
        for (const variant of variants) {
            const cap = caps.get(String(variant.id));
            if (!cap) {
                continue;
            }
            const current = variant.facetValues.map(fv => String(fv.id));
            const next = [
                ...new Set([
                    ...current.filter(id => !deliveryValueIds.has(id)),
                    ...cap.modes.map(mode => ids[mode]).filter((id) => !!id),
                ]),
            ].sort();
            const currentSorted = [...current].sort();
            if (next.length === currentSorted.length &&
                next.every((id, index) => id === currentSorted[index])) {
                continue;
            }
            await this.productVariantService.update(ctx, [
                { id: variant.id, facetValueIds: next },
            ]);
            updated++;
        }
        if (updated > 0) {
            core_1.Logger.info(`同步配送 facet：channel=${ctx.channelId} 更新 ${updated}/${variants.length} 个变体`, constants_1.loggerCtx);
        }
        return updated;
    }
};
exports.DeliveryFacetService = DeliveryFacetService;
exports.DeliveryFacetService = DeliveryFacetService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.FacetService,
        core_1.FacetValueService,
        core_1.ChannelService,
        core_1.ProductVariantService,
        shipping_profile_service_1.ShippingProfileService])
], DeliveryFacetService);
//# sourceMappingURL=delivery-facet.service.js.map