"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStockAllocationStrategy = void 0;
class ChannelStockAllocationStrategy {
    shouldAllocateStock(_ctx, _fromState, toState) {
        // 下单（进入 ArrangingPayment）即分配库存，且只在进入 ArrangingPayment 时分配一次。
        // 注意：不能对所有非 Cancelled 转换都返回 true —— 否则订单后续每次状态转换
        // （如 ArrangingPayment → PaymentSettled）都会再次 createAllocationsForOrder，
        // 产生重复 Allocation 记录，污染售后回补按 Allocation 分组的仓间比例。
        // 进入 Cancelled 时同样不分配，避免抵消 cancelOrder 流程中的 RELEASE。
        return toState === 'ArrangingPayment';
    }
    async allocateFromStockLocation(ctx, stockLocations, _item) {
        var _a;
        if (stockLocations.length === 0) {
            return undefined;
        }
        const ccf = ctx.channel.customFields;
        const strategy = (_a = ccf === null || ccf === void 0 ? void 0 : ccf.shippingStrategy) !== null && _a !== void 0 ? _a : 'priority';
        switch (strategy) {
            case 'priority': {
                const priorityConfig = (ccf === null || ccf === void 0 ? void 0 : ccf.stockLocationPriority)
                    ? JSON.parse(ccf.stockLocationPriority)
                    : [];
                if (priorityConfig.length > 0) {
                    const sorted = [...stockLocations].sort((a, b) => {
                        var _a, _b, _c, _d;
                        const pa = (_b = (_a = priorityConfig.find((p) => p.locationId === a.id)) === null || _a === void 0 ? void 0 : _a.priority) !== null && _b !== void 0 ? _b : 999;
                        const pb = (_d = (_c = priorityConfig.find((p) => p.locationId === b.id)) === null || _c === void 0 ? void 0 : _c.priority) !== null && _d !== void 0 ? _d : 999;
                        return pa - pb;
                    });
                    return sorted[0];
                }
                return stockLocations[0];
            }
            case 'stock-first': {
                const sorted = [...stockLocations].sort((a, b) => b.stockOnHand - a.stockOnHand);
                return sorted[0];
            }
            case 'nearest':
            default:
                return stockLocations[0];
        }
    }
}
exports.ChannelStockAllocationStrategy = ChannelStockAllocationStrategy;
//# sourceMappingURL=channel-stock-allocation-strategy.js.map