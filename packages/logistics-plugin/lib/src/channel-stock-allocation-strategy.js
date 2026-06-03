"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStockAllocationStrategy = void 0;
class ChannelStockAllocationStrategy {
    shouldAllocateStock() {
        return true;
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