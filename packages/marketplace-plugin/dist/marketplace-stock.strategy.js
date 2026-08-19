"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplaceStockLocationStrategy = void 0;
const core_1 = require("@vendure/core");
const logistics_plugin_1 = require("@vendure/logistics-plugin");
const constants_1 = require("./constants");
const MARKETPLACE_SUFFIX = '-marketplace';
const STORE_SUFFIX = '-store';
/**
 * @description
 * 组合库存策略：继承 {@link NearestStockLocationStrategy}（就近发货 + 多仓数量拆分 +
 * 原发货仓记录 orderLine.customFields.stockLocationId），仅在下单分配库存时按销售来源
 * 预筛目标仓，其余逻辑（分配/释放/销售/取消、多仓核算、原发货仓留痕）全部委托父级：
 *
 * - marketplace 销售 → 仅用 `<商家>-marketplace` 仓
 * - 普通销售 → 仅用 `<商家>-store` 仓
 *
 * 预筛后交给父级完成就近分配与库存核算，保证：
 *   1) 每个 location 只分配应分配的数量（不再对全部仓各写全量 ALLOCATION 流水）；
 *   2) orderLine.customFields.stockLocationId 被正确记录，供售后回补定位原发货仓。
 */
class MarketplaceStockLocationStrategy extends logistics_plugin_1.NearestStockLocationStrategy {
    async init(injector) {
        await super.init(injector);
        this.entityHydrator = injector.get(core_1.EntityHydrator);
    }
    async forAllocation(ctx, stockLocations, orderLine, quantity) {
        const isMarketplace = await this.isMarketplaceSale(ctx, orderLine);
        const suffix = isMarketplace ? MARKETPLACE_SUFFIX : STORE_SUFFIX;
        const targetLocations = stockLocations.filter(loc => loc.name.endsWith(suffix));
        // 未找到带对应后缀的 location 时回退到全部传入的 location，保证库存操作仍可进行。
        const pool = targetLocations.length > 0 ? targetLocations : stockLocations;
        return super.forAllocation(ctx, pool, orderLine, quantity);
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
