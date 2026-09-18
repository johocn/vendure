"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicalAwareStockLocationStrategy = void 0;
const core_1 = require("@vendure/core");
const logistics_plugin_1 = require("@vendure/logistics-plugin");
const typeorm_1 = require("typeorm");
const variant_location_binding_service_1 = require("./variant-location-binding.service");
const mirror_math_1 = require("./mirror-math");
const delivery_methods_1 = require("./delivery-methods");
/**
 * 绑定感知库存策略：在 MatrixStockLocationStrategy（就近+门禁+矩阵）之上，
 * 物理驱动变体（有 VariantLocationBinding）只从绑定物理仓分配/发货；
 * 纯虚拟变体完全走父类逻辑（虚拟仓为唯一渠道仓）。
 * 物理仓挂渠道（create 默认行为），父类渠道过滤天然通过。
 */
class PhysicalAwareStockLocationStrategy extends logistics_plugin_1.MatrixStockLocationStrategy {
    async init(injector) {
        await super.init(injector);
        this.bindingService = injector.get(variant_location_binding_service_1.VariantLocationBindingService);
    }
    async boundLocations(ctx, variantId) {
        const bindings = await this.bindingService.findByVariant(variantId);
        if (!bindings.length) {
            return null;
        }
        const locs = await this.connection.getRepository(ctx, core_1.StockLocation).find({
            where: { id: (0, typeorm_1.In)(bindings.map(b => b.locationId)) },
            loadEagerRelations: false,
        });
        return (0, mirror_math_1.pickLocationsByIds)(locs, bindings.map(b => b.locationId));
    }
    async getAvailableStock(ctx, productVariantId, stockLevels) {
        const bindings = await this.bindingService.findByVariant(productVariantId);
        if (!bindings.length) {
            return super.getAvailableStock(ctx, productVariantId, stockLevels);
        }
        // 物理驱动：只统计虚拟仓（镜像值即 Σ 物理仓），避免与物理仓原始值重复计算
        let stockOnHand = 0;
        let stockAllocated = 0;
        for (const level of stockLevels) {
            const kind = await this.locationKindOf(ctx, level.stockLocationId);
            if (kind === 'virtual') {
                stockOnHand += level.stockOnHand;
                stockAllocated += level.stockAllocated;
            }
        }
        return { stockOnHand, stockAllocated };
    }
    async locationKindOf(ctx, locationId) {
        return this.requestContextCache.get(ctx, `PhysicalAware.kind.${locationId}`, async () => {
            var _a, _b;
            const loc = await this.connection.getEntityOrThrow(ctx, core_1.StockLocation, locationId, {
                loadEagerRelations: false,
            });
            return String((_b = (_a = loc.customFields) === null || _a === void 0 ? void 0 : _a.kind) !== null && _b !== void 0 ? _b : 'virtual');
        });
    }
    async forAllocation(ctx, stockLocations, orderLine, quantity) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        const candidates = bound !== null && bound !== void 0 ? bound : stockLocations;
        // deliveryMethods：商品仅支持自提 → 只从自提点分配；仅支持邮寄 → 只从可发仓分配；空=不过滤（兼容旧数据）
        const productMethods = await this.productDeliveryMethods(ctx, orderLine.productVariantId);
        const filtered = productMethods.length ? (0, delivery_methods_1.filterLocationsByDelivery)(candidates, productMethods) : candidates;
        return super.forAllocation(ctx, filtered, orderLine, quantity);
    }
    async productDeliveryMethods(ctx, productVariantId) {
        var _a, _b;
        try {
            const variant = await this.connection.getRepository(ctx, core_1.ProductVariant).findOne({
                where: { id: productVariantId },
                relations: ['product'],
            });
            const methods = (_b = (_a = variant === null || variant === void 0 ? void 0 : variant.product) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.deliveryMethods;
            return (Array.isArray(methods) ? methods : []).filter((m) => !!m);
        }
        catch (_c) {
            return [];
        }
    }
    async forSale(ctx, stockLocations, orderLine, quantity) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        if (!bound) {
            return super.forSale(ctx, stockLocations, orderLine, quantity);
        }
        return super.forSale(ctx, bound, orderLine, quantity);
    }
    async forRelease(ctx, stockLocations, orderLine, quantity) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        if (!bound) {
            return super.forRelease(ctx, stockLocations, orderLine, quantity);
        }
        return super.forRelease(ctx, bound, orderLine, quantity);
    }
    async forCancellation(ctx, stockLocations, orderLine, quantity) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        if (!bound) {
            return super.forCancellation(ctx, stockLocations, orderLine, quantity);
        }
        return super.forCancellation(ctx, bound, orderLine, quantity);
    }
}
exports.PhysicalAwareStockLocationStrategy = PhysicalAwareStockLocationStrategy;
//# sourceMappingURL=physical-aware-stock-location-strategy.js.map