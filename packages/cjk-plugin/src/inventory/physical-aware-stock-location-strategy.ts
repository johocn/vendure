import { Injector, ID, ProductVariant, RequestContext, StockLevel, StockLocation } from '@vendure/core';
import { MatrixStockLocationStrategy } from '@vendure/logistics-plugin';
import { In } from 'typeorm';
import { VariantLocationBindingService } from './variant-location-binding.service';
import { pickLocationsByIds } from './mirror-math';
import { filterLocationsByDelivery, type DeliveryMethod } from './delivery-methods';

/**
 * 绑定感知库存策略：在 MatrixStockLocationStrategy（就近+门禁+矩阵）之上，
 * 物理驱动变体（有 VariantLocationBinding）只从绑定物理仓分配/发货；
 * 纯虚拟变体完全走父类逻辑（虚拟仓为唯一渠道仓）。
 * 物理仓挂渠道（create 默认行为），父类渠道过滤天然通过。
 */
export class PhysicalAwareStockLocationStrategy extends MatrixStockLocationStrategy {
    protected bindingService: VariantLocationBindingService;

    override async init(injector: Injector): Promise<void> {
        await super.init(injector);
        this.bindingService = injector.get(VariantLocationBindingService);
    }

    private async boundLocations(ctx: RequestContext, variantId: ID): Promise<StockLocation[] | null> {
        const bindings = await this.bindingService.findByVariant(variantId);
        if (!bindings.length) {
            return null;
        }
        const locs = await this.connection.getRepository(ctx, StockLocation).find({
            where: { id: In(bindings.map(b => b.locationId)) },
            loadEagerRelations: false,
        });
        return pickLocationsByIds(locs, bindings.map(b => b.locationId));
    }

    override async getAvailableStock(
        ctx: RequestContext,
        productVariantId: ID,
        stockLevels: StockLevel[],
    ): Promise<{ stockOnHand: number; stockAllocated: number }> {
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

    private async locationKindOf(ctx: RequestContext, locationId: ID): Promise<string> {
        return this.requestContextCache.get(ctx, `PhysicalAware.kind.${locationId}`, async () => {
            const loc = await this.connection.getEntityOrThrow(ctx, StockLocation, locationId, {
                loadEagerRelations: false,
            });
            return String((loc.customFields as any)?.kind ?? 'virtual');
        });
    }

    override async forAllocation(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: any,
        quantity: number,
    ) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        const candidates = bound ?? stockLocations;
        // deliveryMethods：商品仅支持自提 → 只从自提点分配；仅支持邮寄 → 只从可发仓分配；空=不过滤（兼容旧数据）
        const productMethods = await this.productDeliveryMethods(ctx, orderLine.productVariantId);
        const filtered = productMethods.length ? filterLocationsByDelivery(candidates, productMethods) : candidates;
        return super.forAllocation(ctx, filtered, orderLine, quantity);
    }

    private async productDeliveryMethods(ctx: RequestContext, productVariantId: ID): Promise<DeliveryMethod[]> {
        try {
            const variant = await this.connection.getRepository(ctx, ProductVariant).findOne({
                where: { id: productVariantId as any },
                relations: ['product'],
            });
            const methods = (variant?.product?.customFields as any)?.deliveryMethods;
            return (Array.isArray(methods) ? methods : []).filter((m: unknown): m is string => !!m) as DeliveryMethod[];
        } catch {
            return [];
        }
    }

    override async forSale(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: any,
        quantity: number,
    ) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        if (!bound) {
            return super.forSale(ctx, stockLocations, orderLine, quantity);
        }
        return super.forSale(ctx, bound, orderLine, quantity);
    }

    override async forRelease(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: any,
        quantity: number,
    ) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        if (!bound) {
            return super.forRelease(ctx, stockLocations, orderLine, quantity);
        }
        return super.forRelease(ctx, bound, orderLine, quantity);
    }

    override async forCancellation(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: any,
        quantity: number,
    ) {
        const bound = await this.boundLocations(ctx, orderLine.productVariantId);
        if (!bound) {
            return super.forCancellation(ctx, stockLocations, orderLine, quantity);
        }
        return super.forCancellation(ctx, bound, orderLine, quantity);
    }
}
