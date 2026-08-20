import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderPackage } from './order-package.entity';
import { OrderPackageService } from './order-package.service';
import { OrderSplitPlan, SplitLine } from './order-split-plan';

@Resolver()
export class SplitAdminResolver {
    constructor(
        private autoSplit: AutoSplitPlanService,
        private manualSplit: ManualSplitAdjustService,
        private orderPackageService: OrderPackageService,
    ) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async splitPlanPreview(@Ctx() ctx: RequestContext, @Args('orderId') orderId: string): Promise<OrderSplitPlan> {
        return this.autoSplit.buildAutoPlan(ctx, orderId);
    }

    /** 订单级包裹查询：按包追溯 仓/行/运费/履约/配送 */
    @Query()
    @Allow(Permission.ReadOrder)
    async orderPackages(@Ctx() ctx: RequestContext, @Args('orderId') orderId: string) {
        const list = await this.orderPackageService.findByOrder(ctx, orderId);
        return list.map((p: OrderPackage) => ({
            id: p.id,
            code: p.code,
            orderId: p.orderId,
            stockLocationId: p.stockLocationId,
            lines: p.linesJson ? JSON.parse(p.linesJson) : [],
            shippingFee: p.shippingFee,
            deliveryMode: p.deliveryMode,
            fulfillmentId: p.fulfillmentId,
            deliveryOrderId: p.deliveryOrderId,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        }));
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async confirmSplitPlan(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
        @Args('packages') packages: Array<{ stockLocationId: string; lines: SplitLine[] }>,
    ): Promise<OrderSplitPlan> {
        const plan = await this.manualSplit.applyAdjustment(ctx, orderId, packages);
        // 挂钩点1：拆单确认成功 → 把内存计划持久化为 OrderPackage（先删后插，幂等）
        await this.orderPackageService.replaceForOrder(
            ctx,
            orderId,
            plan.packages.map(p => ({
                packageId: p.packageId,
                stockLocationId: p.stockLocationId,
                lines: p.lines,
                estimatedShippingFee: p.estimatedShippingFee,
                deliveryMode: p.deliveryMode,
            })),
        );
        return plan;
    }
}
