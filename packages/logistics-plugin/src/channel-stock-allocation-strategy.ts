import { RequestContext, StockAllocationStrategy } from '@vendure/core';

export class ChannelStockAllocationStrategy implements StockAllocationStrategy {
    shouldAllocateStock(): boolean | Promise<boolean> {
        return true;
    }

    async allocateFromStockLocation(
        ctx: RequestContext,
        stockLocations: Array<{ id: string; stockOnHand: number }>,
        _item: any,
    ): Promise<any> {
        if (stockLocations.length === 0) {
            return undefined;
        }

        const ccf = (ctx.channel as any).customFields;
        const strategy = ccf?.shippingStrategy ?? 'priority';

        switch (strategy) {
            case 'priority': {
                const priorityConfig = ccf?.stockLocationPriority
                    ? JSON.parse(ccf.stockLocationPriority)
                    : [];
                if (priorityConfig.length > 0) {
                    const sorted = [...stockLocations].sort((a, b) => {
                        const pa = priorityConfig.find((p: any) => p.locationId === a.id)?.priority ?? 999;
                        const pb = priorityConfig.find((p: any) => p.locationId === b.id)?.priority ?? 999;
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
