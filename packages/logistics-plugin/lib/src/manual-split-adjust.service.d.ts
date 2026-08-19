import { ID, Injector, RequestContext } from '@vendure/core';
import { OrderSplitPlan, SplitLine } from './order-split-plan';
export declare class ManualSplitAdjustService {
    private injector;
    private connection;
    private stockLevelService;
    init(injector: Injector): void;
    /**
     * 应用管理员调整：packages 每行数量守恒校验 + 每仓可售校验，产出最终计划。
     * @param packages 管理员提交的每包行明细（改仓 = 调整 stockLocationId 分组）
     */
    applyAdjustment(ctx: RequestContext, orderId: ID, packages: Array<{
        stockLocationId: string;
        lines: SplitLine[];
    }>): Promise<OrderSplitPlan>;
    private assertStockSufficient;
    private getStockLevel;
}
