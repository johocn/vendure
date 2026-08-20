import { OrderService, RequestContext } from '@vendure/core';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderCompleteAutoService } from './order-complete-auto.service';
import { OrderPackageService } from './order-package.service';
import { OrderSplitPlan, SplitLine } from './order-split-plan';
export declare class SplitAdminResolver {
    private autoSplit;
    private manualSplit;
    private orderPackageService;
    private orderCompleteAuto;
    private orderService;
    constructor(autoSplit: AutoSplitPlanService, manualSplit: ManualSplitAdjustService, orderPackageService: OrderPackageService, orderCompleteAuto: OrderCompleteAutoService, orderService: OrderService);
    splitPlanPreview(ctx: RequestContext, orderId: string): Promise<OrderSplitPlan>;
    /** 订单级包裹查询：按包追溯 仓/行/运费/履约/配送 */
    orderPackages(ctx: RequestContext, orderId: string): Promise<{
        id: import("@vendure/core").ID;
        code: string;
        orderId: import("@vendure/core").ID;
        stockLocationId: import("@vendure/core").ID;
        lines: any;
        shippingFee: number | null;
        deliveryMode: string;
        fulfillmentId: import("@vendure/core").ID | null;
        deliveryOrderId: import("@vendure/core").ID | null;
        status: import("./order-package.entity").OrderPackageStatus;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    confirmSplitPlan(ctx: RequestContext, orderId: string, packages: Array<{
        stockLocationId: string;
        lines: SplitLine[];
    }>): Promise<OrderSplitPlan>;
    /** self 包人工送达确认：OrderPackage shipped→delivered（幂等；非法状态返回 false） */
    markPackageDelivered(ctx: RequestContext, orderId: string, packageId: string): Promise<boolean>;
    /** 手动交易完成：Delivered → Completed（幂等；非 Delivered 状态返回 false） */
    completeOrder(ctx: RequestContext, orderId: string): Promise<boolean>;
    /** 手动触发自动交易完成扫描，返回本次完成订单数（运营/e2e 用） */
    runAutoCompleteScan(ctx: RequestContext): Promise<number>;
}
