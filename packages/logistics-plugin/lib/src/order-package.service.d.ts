import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { OrderPackage } from './order-package.entity';
import { SplitLine } from './order-split-plan';
/** 拆单确认时写入的包裹载荷（字段取自 SplitPackage） */
export interface OrderPackageInput {
    packageId: string;
    stockLocationId: ID;
    lines: SplitLine[];
    estimatedShippingFee: number;
    deliveryMode: string;
}
export declare class OrderPackageService {
    private connection;
    constructor(connection: TransactionalConnection);
    /** 拆单确认：先删后插（幂等，重复确认干净替换），返回落库后的包裹列表 */
    replaceForOrder(ctx: RequestContext, orderId: ID, packages: OrderPackageInput[]): Promise<OrderPackage[]>;
    /** 发货回填：按 orderId + code 匹配包裹，补 fulfillmentId 与实际运费，返回是否命中 */
    linkFulfillment(ctx: RequestContext, orderId: ID, packageId: string, fulfillmentId: ID, actualShippingFee: number | null): Promise<boolean>;
    /** 配送关联：按 orderId + code 匹配包裹，回填 deliveryOrderId，返回是否命中 */
    linkDeliveryOrder(ctx: RequestContext, orderId: ID, packageId: string, deliveryOrderId: ID): Promise<boolean>;
    /** 订单级包裹查询（按包号排序） */
    findByOrder(ctx: RequestContext, orderId: ID): Promise<OrderPackage[]>;
}
