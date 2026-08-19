import { ID } from '@vendure/core';

/** 一行在一个包中的数量 */
export interface SplitLine {
    orderLineId: ID;
    quantity: number;
}

/** 一个包 = 一个出货仓的履约单元；预留升级 OrderPackage 实体的数据契约 */
export interface SplitPackage {
    packageId: string;                 // 包号，如 P1/P2
    stockLocationId: ID;
    lines: SplitLine[];
    estimatedShippingFee: number;
    deliveryMode: 'self' | 'city';     // 自有司机 / 同城配送（Task 5 使用）
    deliveryOrderId?: ID;
}

export interface OrderSplitPlan {
    orderId: ID;
    packages: SplitPackage[];
}

/** 拆单计划提供方抽象：现阶段内存推导，未来可替换为 OrderPackage 实体持久化实现 */
export interface OrderSplitPlanProvider {
    buildAutoPlan(ctx: import('@vendure/core').RequestContext, orderId: ID): Promise<OrderSplitPlan>;
}
