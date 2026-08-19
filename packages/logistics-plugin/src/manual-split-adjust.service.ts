import { Injectable } from '@nestjs/common';
import {
    ID,
    Injector,
    Logger,
    Order,
    OrderLine,
    RequestContext,
    StockLevelService,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { loggerCtx } from './matrix-allocators';
import { OrderSplitPlan, SplitLine, SplitPackage } from './order-split-plan';

@Injectable()
export class ManualSplitAdjustService {
    private injector!: Injector;
    private connection!: TransactionalConnection;
    private stockLevelService!: StockLevelService;

    init(injector: Injector): void {
        this.injector = injector;
        this.connection = injector.get(TransactionalConnection);
        try {
            this.stockLevelService = injector.get(StockLevelService);
        } catch {
            /* 可售校验降级：无 StockLevelService 时跳过校验 */
        }
    }

    /**
     * 应用管理员调整：packages 每行数量守恒校验 + 每仓可售校验，产出最终计划。
     * @param packages 管理员提交的每包行明细（改仓 = 调整 stockLocationId 分组）
     */
    async applyAdjustment(
        ctx: RequestContext,
        orderId: ID,
        packages: Array<{ stockLocationId: string; lines: SplitLine[] }>,
    ): Promise<OrderSplitPlan> {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['lines'],
        });
        const originalQty = new Map<string, number>();
        for (const line of (order?.lines ?? []) as Array<OrderLine & { id: string }>) {
            originalQty.set(String(line.id), line.quantity);
        }
        const sumQty = new Map<string, number>();
        for (const pkg of packages) {
            for (const l of pkg.lines) {
                const k = String(l.orderLineId);
                sumQty.set(k, (sumQty.get(k) ?? 0) + l.quantity);
            }
        }
        for (const [lineId, qty] of originalQty) {
            if ((sumQty.get(lineId) ?? 0) !== qty) {
                throw new UserInputError(
                    `行 ${lineId} 数量不守恒：原 ${qty}，调整后 ${sumQty.get(lineId) ?? 0}`,
                );
            }
        }
        await this.assertStockSufficient(ctx, packages);
        const result: OrderSplitPlan = {
            orderId,
            packages: packages.map((p, i) => ({
                packageId: `P${i + 1}`,
                stockLocationId: p.stockLocationId,
                lines: p.lines,
                estimatedShippingFee: 0,
                deliveryMode: 'self',
            })),
        };
        Logger.info(`手动调单 order#${order?.code ?? orderId} 确认 ${result.packages.length} 包`, loggerCtx);
        return result;
    }

    private async assertStockSufficient(
        ctx: RequestContext,
        packages: Array<{ stockLocationId: string; lines: SplitLine[] }>,
    ): Promise<void> {
        const byLoc = new Map<string, Map<string, number>>();
        for (const pkg of packages) {
            for (const l of pkg.lines) {
                const k = String(l.orderLineId);
                if (!byLoc.has(pkg.stockLocationId)) {
                    byLoc.set(pkg.stockLocationId, new Map());
                }
                const m = byLoc.get(pkg.stockLocationId)!;
                m.set(k, (m.get(k) ?? 0) + l.quantity);
            }
        }
        for (const [locId, lines] of byLoc) {
            for (const [lineId, qty] of lines) {
                const line = await this.connection.getRepository(ctx, OrderLine).findOne({
                    where: { id: lineId as any },
                });
                const variantId = (line as any).productVariantId;
                const level = await this.getStockLevel(ctx, variantId, locId);
                // 手动调单是对本订单自身分配的重新编排：本单已分配量（stockAllocated）会随确认被重排，
                // 因此以该仓物理货量 onHand 作为上限（不允许把一个仓调到超过其实际库存），
                // 而不是扣除本单自身已分配后的"可售"，否则系统自动拆出的同一计划都无法通过校验。
                const onHand = level?.stockOnHand ?? 0;
                if (onHand < qty) {
                    throw new UserInputError(
                        `仓 ${locId} 对行 ${lineId} 货量不足：需 ${qty}，仓内 ${onHand}`,
                    );
                }
            }
        }
    }

    private async getStockLevel(ctx: RequestContext, variantId: any, locationId: string): Promise<any> {
        if (!this.stockLevelService) {
            return undefined;
        }
        try {
            return await this.stockLevelService.getStockLevel(ctx, variantId, locationId);
        } catch (e: any) {
            Logger.warn(`可售校验读取失败: ${e?.message ?? e}`, loggerCtx);
            return undefined;
        }
    }
}
