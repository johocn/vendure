"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceStockLocationStrategy = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
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
class MarketplaceStockLocationStrategy {
    init(injector) {
        this.entityHydrator = injector.get(core_1.EntityHydrator);
    }
    getAvailableStock(ctx, productVariantId, stockLevels) {
        let stockOnHand = 0;
        let stockAllocated = 0;
        for (const stockLevel of stockLevels) {
            stockOnHand += stockLevel.stockOnHand;
            stockAllocated += stockLevel.stockAllocated;
        }
        return { stockOnHand, stockAllocated };
    }
    async forAllocation(ctx, stockLocations, orderLine, quantity) {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }
    async forRelease(ctx, stockLocations, orderLine, quantity) {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }
    async forSale(ctx, stockLocations, orderLine, quantity) {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }
    async forCancellation(ctx, stockLocations, orderLine, quantity) {
        return this.getLocationForLine(ctx, stockLocations, orderLine, quantity);
    }
    async getLocationForLine(ctx, stockLocations, orderLine, quantity) {
        const isMarketplace = await this.isMarketplaceSale(ctx, orderLine);
        const suffix = isMarketplace ? MARKETPLACE_SUFFIX : STORE_SUFFIX;
        const targetLocations = stockLocations.filter(loc => loc.name.endsWith(suffix));
        // 若未找到带对应后缀的 location，则回退到全部传入的 location，保证库存操作仍可进行。
        if (targetLocations.length === 0) {
            return stockLocations.map(loc => ({ location: loc, quantity }));
        }
        return targetLocations.map(loc => ({ location: loc, quantity }));
    }
    async isMarketplaceSale(ctx, orderLine) {
        var _a, _b;
        if (!orderLine.order) {
            await this.entityHydrator.hydrate(ctx, orderLine, { relations: ['order'] });
        }
        return ((_b = (_a = orderLine.order) === null || _a === void 0 ? void 0 : _a.customFields) === null || _b === void 0 ? void 0 : _b.saleSource) === constants_1.SALE_SOURCE_MARKETPLACE;
    }
}
exports.MarketplaceStockLocationStrategy = MarketplaceStockLocationStrategy;
