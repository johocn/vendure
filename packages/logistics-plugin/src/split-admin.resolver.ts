import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, isGraphQlErrorResult, OrderService, Permission, RequestContext } from '@vendure/core';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderCompleteAutoService } from './order-complete-auto.service';
import { OrderPackage } from './order-package.entity';
import { OrderPackageService } from './order-package.service';
import { OrderSplitPlan, SplitLine } from './order-split-plan';

@Resolver()
export class SplitAdminResolver {
    constructor(
        private autoSplit: AutoSplitPlanService,
        private manualSplit: ManualSplitAdjustService,
        private orderPackageService: OrderPackageService,
        private orderCompleteAuto: OrderCompleteAutoService,
        private orderService: OrderService,
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
            status: p.status,
            shippedAt: p.shippedAt,
            deliveredAt: p.deliveredAt,
            cancelledAt: p.cancelledAt,
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
        // 同步重算拆单运费：确保支付前 shippingWithTax 已落定（否则支付额漏计运费 → 订单滞留 ArrangingPayment）
        await this.orderPackageService.finalizeSplitShipping(ctx, orderId);
        return plan;
    }

    /** self 包人工送达确认：OrderPackage shipped→delivered（幂等；非法状态返回 false） */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async markPackageDelivered(
        @Ctx() ctx: RequestContext,
        @Args('orderId') orderId: string,
        @Args('packageId') packageId: string,
    ): Promise<boolean> {
        return this.orderPackageService.transition(ctx, orderId, packageId, 'delivered');
    }

    /** 手动交易完成：Delivered → Completed（幂等；非 Delivered 状态返回 false） */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async completeOrder(@Ctx() ctx: RequestContext, @Args('orderId') orderId: string): Promise<boolean> {
        const order = await this.orderService.findOne(ctx, orderId);
        if (!order) return false;
        if (order.state === 'Completed') return true; // 幂等
        if (order.state !== 'Delivered') return false; // 仅 Delivered 可确认收货
        const result = await this.orderService.transitionToState(ctx, orderId, 'Completed' as any);
        return !isGraphQlErrorResult(result);
    }

    /** 手动触发自动交易完成扫描，返回本次完成订单数（运营/e2e 用） */
    @Mutation()
    @Allow(Permission.UpdateOrder)
    async runAutoCompleteScan(@Ctx() ctx: RequestContext): Promise<number> {
        return this.orderCompleteAuto.runAutoCompleteScan(ctx);
    }
}
