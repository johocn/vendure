import { RequestContext } from '@vendure/core';
import { AutoSplitPlanService } from './auto-split-plan.service';
import { ManualSplitAdjustService } from './manual-split-adjust.service';
import { OrderPackageService } from './order-package.service';
import { OrderSplitPlan, SplitLine } from './order-split-plan';
export declare class SplitAdminResolver {
    private autoSplit;
    private manualSplit;
    private orderPackageService;
    constructor(autoSplit: AutoSplitPlanService, manualSplit: ManualSplitAdjustService, orderPackageService: OrderPackageService);
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
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    confirmSplitPlan(ctx: RequestContext, orderId: string, packages: Array<{
        stockLocationId: string;
        lines: SplitLine[];
    }>): Promise<OrderSplitPlan>;
}
