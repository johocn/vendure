import { RequestContext, StockAllocationStrategy } from '@vendure/core';

export class ChannelStockAllocationStrategy implements StockAllocationStrategy {
    shouldAllocateStock(
        _ctx: RequestContext,
        _fromState: any,
        toState: any,
    ): boolean | Promise<boolean> {
        // 下单（进入 ArrangingPayment）即分配库存，且只在进入 ArrangingPayment 时分配一次。
        // 注意：不能对所有非 Cancelled 转换都返回 true —— 否则订单后续每次状态转换
        // （如 ArrangingPayment → PaymentSettled）都会再次 createAllocationsForOrder，
        // 产生重复 Allocation 记录，污染售后回补按 Allocation 分组的仓间比例。
        // 进入 Cancelled 时同样不分配，避免抵消 cancelOrder 流程中的 RELEASE。
        return toState === 'ArrangingPayment';
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
