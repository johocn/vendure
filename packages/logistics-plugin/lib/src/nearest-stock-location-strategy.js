"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearestStockLocationStrategy = void 0;
const core_1 = require("@vendure/core");
const location_utils_1 = require("./location-utils");
const loggerCtx = 'NearestStockLocationStrategy';
function readOrderGeo(orderLine) {
    var _a, _b;
    const cf = ((_b = (_a = orderLine.order) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : {});
    const lat = cf.lat != null ? Number(cf.lat) : NaN;
    const lng = cf.lng != null ? Number(cf.lng) : NaN;
    return {
        lat: isFinite(lat) ? lat : null,
        lng: isFinite(lng) ? lng : null,
        city: cf.city ? String(cf.city) : null,
    };
}
/**
 * 就近发货 + 服务范围门禁 的 StockLocationStrategy。
 *
 * 继承 {@link MultiChannelStockLocationStrategy}（保留其库存核算/渠道过滤能力），
 * 仅覆写 `forAllocation`：在下单分配库存时，
 *   1) 若订单带定位 → 按订单经纬度与仓库距离升序排列（真正的"就近"）；
 *   2) 若订单带城市 → 先过滤出服务该城市的仓库（超区门禁）；
 *   3) 订单无定位时退化为父级默认分配顺序。
 *
 * 仓库/门店的经纬度与服务城市从 StockLocation 自定义字段 `lat/lng/serviceCities` 读取。
 */
class NearestStockLocationStrategy extends core_1.MultiChannelStockLocationStrategy {
    async forAllocation(ctx, stockLocations, orderLine, quantity) {
        const ordered = this.orderByProximity(stockLocations, orderLine);
        const result = await super.forAllocation(ctx, ordered, orderLine, quantity);
        // 记录原分配仓：就近结果中数量为正的首个 location，供售后回补定位原发货仓
        await this.persistAllocationLocation(ctx, orderLine, result);
        return result;
    }
    /**
     * 将原分配仓写入 OrderLine 自定义字段 stockLocationId。
     * 失败仅告警，绝不阻断下单/分配主流程。
     */
    async persistAllocationLocation(ctx, orderLine, result) {
        var _a, _b, _c;
        try {
            const chosen = result.find(r => r.quantity > 0);
            if (!chosen)
                return;
            const locId = String(chosen.location.id);
            const current = (_a = orderLine.customFields) === null || _a === void 0 ? void 0 : _a.stockLocationId;
            if (current != null && String(current) === locId) {
                return; // 已一致，无需重复写
            }
            const repo = this.connection.getRepository(ctx, core_1.OrderLine);
            await repo.update({ id: orderLine.id }, { customFields: Object.assign(Object.assign({}, ((_b = orderLine.customFields) !== null && _b !== void 0 ? _b : {})), { stockLocationId: locId }) });
            orderLine.customFields.stockLocationId = locId;
            core_1.Logger.debug(`orderLine#${orderLine.id} 原分配仓 -> loc#${locId}`, loggerCtx);
        }
        catch (e) {
            core_1.Logger.warn(`记录原分配仓失败（不影响下单）: ${(_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e}`, loggerCtx);
        }
    }
    orderByProximity(stockLocations, orderLine) {
        const geo = readOrderGeo(orderLine);
        let candidates = stockLocations;
        // 超区门禁：订单带城市时，仅保留服务该城市的仓库/门店
        if (geo.city) {
            const serving = stockLocations.filter(loc => this.servesCity(loc, geo.city));
            if (serving.length > 0) {
                candidates = serving;
            }
            // 全部超区时保留原列表（前端已做超区提示，这里不中断下单，仍可履约）
        }
        // 就近：订单带定位时按距离升序
        if (geo.lat != null && geo.lng != null) {
            return [...candidates].sort((a, b) => this.locationDistanceKm(a, geo) - this.locationDistanceKm(b, geo));
        }
        return candidates;
    }
    servesCity(loc, city) {
        var _a;
        const serviceCities = (_a = loc.customFields) === null || _a === void 0 ? void 0 : _a.serviceCities;
        if (!Array.isArray(serviceCities) || serviceCities.length === 0) {
            return true; // 未配置服务城市 = 全域可服务
        }
        return serviceCities.includes(city);
    }
    locationDistanceKm(loc, geo) {
        var _a;
        const cf = (_a = loc.customFields) !== null && _a !== void 0 ? _a : {};
        const lat = cf.lat != null ? Number(cf.lat) : NaN;
        const lng = cf.lng != null ? Number(cf.lng) : NaN;
        if (!isFinite(lat) || !isFinite(lng)) {
            return Number.MAX_SAFE_INTEGER;
        }
        return (0, location_utils_1.distanceKm)({ lat, lng }, { lat: geo.lat, lng: geo.lng });
    }
}
exports.NearestStockLocationStrategy = NearestStockLocationStrategy;
//# sourceMappingURL=nearest-stock-location-strategy.js.map