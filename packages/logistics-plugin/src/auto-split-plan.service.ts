import { Injectable } from '@nestjs/common';
import {
    ID,
    Injector,
    Logger,
    Order,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { loggerCtx } from './matrix-allocators';
import { OrderSplitPlan, OrderSplitPlanProvider, SplitPackage } from './order-split-plan';

@Injectable()
export class AutoSplitPlanService implements OrderSplitPlanProvider {
    private injector!: Injector;
    private connection!: TransactionalConnection;

    init(injector: Injector): void {
        this.injector = injector;
        this.connection = injector.get(TransactionalConnection);
    }

    async buildAutoPlan(ctx: RequestContext, orderId: ID): Promise<OrderSplitPlan> {
        const order = await this.loadOrderWithLines(ctx, orderId);
        if (!order) {
            Logger.warn(`自动拆单 order#${orderId} 不存在，返回空计划`, loggerCtx);
            return { orderId, packages: [] };
        }
        const packages = new Map<string, SplitPackage>();
        for (const line of order.lines ?? []) {
            const detail = this.parseSplitDetail((line as any).customFields?.stockLocationsJson);
            if (detail.length === 0) {
                continue;
            }
            for (const d of detail) {
                const locId = d.locationId;
                let pkg = packages.get(locId);
                if (!pkg) {
                    pkg = {
                        packageId: `P${packages.size + 1}`,
                        stockLocationId: locId,
                        lines: [],
                        estimatedShippingFee: 0,
                        deliveryMode: 'self',
                    };
                    packages.set(locId, pkg);
                }
                pkg.lines.push({ orderLineId: line.id, quantity: d.quantity });
            }
        }
        const result: OrderSplitPlan = { orderId, packages: [...packages.values()] };
        Logger.info(`自动拆单 order#${order?.code ?? orderId} 共 ${result.packages.length} 包`, loggerCtx);
        return result;
    }

    private parseSplitDetail(raw: unknown): Array<{ locationId: string; quantity: number }> {
        try {
            const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw ?? '[]'));
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }

    private async loadOrderWithLines(ctx: RequestContext, orderId: ID): Promise<Order | null> {
        return this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['lines'],
        });
    }
}
