import {
    AvailableStock,
    EntityHydrator,
    ID,
    Injector,
    LocationWithQuantity,
    OrderLine,
    RequestContext,
    StockLevel,
    StockLocation,
    StockLocationStrategy,
} from '@vendure/core';
import { SALE_SOURCE_MARKETPLACE } from './constants';

const MARKETPLACE_SUFFIX = '-marketplace';
const STORE_SUFFIX = '-store';

/**
 * @description
 * 独立的库存策略：根据订单行的销售来源（Order.customFields.saleSource）决定库存操作
 * 使用哪个 StockLocation。
 *
 * 每个 marketplace 商家需预置两个 StockLocation：
 * - `<商家>-marketplace`：marketplace 销售使用
 * - `<商家>-store`：商家自营销售使用
 *
 * 对于所有库存操作（分配/释放/销售/取消），先判断该 OrderLine 所属订单是否为
 * marketplace 销售，再按对应后缀筛选目标 StockLocation。
 */
export class MarketplaceStockLocationStrategy implements StockLocationStrategy {
    private entityHydrator: EntityHydrator;

    init(injector: Injector) {
        this.entityHydrator = injector.get(EntityHydrator);
    }

    getAvailableStock(
        ctx: RequestContext,
        productVariantId: ID,
        stockLevels: StockLevel[],
    ): AvailableStock | Promise<AvailableStock> {
        let stockOnHand = 0;
        let stockAllocated = 0;
        for (const stockLevel of stockLevels) {
            stockOnHand += stockLevel.stockOnHand;
            stockAllocated += stockLevel.stockAllocated;
        }
        return { stockOnHand, stockAllocated };
    }

    async forAllocation(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<LocationWithQuantity[]> {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }

    async forRelease(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<LocationWithQuantity[]> {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }

    async forSale(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<LocationWithQuantity[]> {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }

    async forCancellation(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<LocationWithQuantity[]> {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }

    private async getLocationForLine(
        ctx: RequestContext,
        stockLocations: StockLocation[],
        orderLine: OrderLine,
        quantity: number,
    ): Promise<LocationWithQuantity[]> {
        const isMarketplace = await this.isMarketplaceSale(ctx, orderLine);
        const suffix = isMarketplace ? MARKETPLACE_SUFFIX : STORE_SUFFIX;
        const targetLocations = stockLocations.filter(loc => loc.name.endsWith(suffix));
        // 若未找到带对应后缀的 location，则回退到全部传入的 location，保证库存操作仍可进行。
        if (targetLocations.length === 0) {
            return stockLocations.map(loc => ({ location: loc, quantity }));
        }
        return targetLocations.map(loc => ({ location: loc, quantity }));
    }

    private async isMarketplaceSale(ctx: RequestContext, orderLine: OrderLine): Promise<boolean> {
        if (!orderLine.order) {
            await this.entityHydrator.hydrate(ctx, orderLine, { relations: ['order'] });
        }
        return orderLine.order?.customFields?.saleSource === SALE_SOURCE_MARKETPLACE;
    }
}