import { ID, Injector, RequestContext, TransactionalConnection } from '@vendure/core';
import { OrderPackage, OrderPackageStatus } from './order-package.entity';
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
    private injector;
    private orderService;
    private deliveryShopLinker;
    constructor(connection: TransactionalConnection);
    /** 由 LogisticsPlugin.onApplicationBootstrap 调用，注入器就绪后解析可选依赖 */
    init(injector: Injector): void;
    /** 拆单确认：先删后插（幂等，重复确认干净替换），返回落库后的包裹列表 */
    replaceForOrder(ctx: RequestContext, orderId: ID, packages: OrderPackageInput[]): Promise<OrderPackage[]>;
    /** 发货回填：按 orderId + code 匹配包裹，补 fulfillmentId 与实际运费，返回是否命中 */
    linkFulfillment(ctx: RequestContext, orderId: ID, packageId: string, fulfillmentId: ID, actualShippingFee: number | null): Promise<boolean>;
    /** 配送关联：按 orderId + code 匹配包裹，回填 deliveryOrderId，返回是否命中 */
    linkDeliveryOrder(ctx: RequestContext, orderId: ID, packageId: string, deliveryOrderId: ID): Promise<boolean>;
    /** 订单级包裹查询（按包号排序） */
    findByOrder(ctx: RequestContext, orderId: ID): Promise<OrderPackage[]>;
    /** 状态流转：幂等（同状态返回 true）、非法流转告警忽略、未命中告警返回 false；不抛错不阻断主链路 */
    transition(ctx: RequestContext, orderId: ID, packageId: string, toStatus: OrderPackageStatus): Promise<boolean>;
    /** C端查询：本人订单包裹列表（按包号排序），返回可直接渲染的富化结果 */
    getMyOrderPackages(ctx: RequestContext, orderId: ID): Promise<Array<{
        code: string;
        deliveryMode: string;
        status: string;
        shippedAt: Date | null;
        deliveredAt: Date | null;
        cancelledAt: Date | null;
        shippingFee: number | null;
        lines: Array<{
            orderLineId: ID;
            quantity: number;
            productName: string;
            sku: string;
        }>;
        trackingNo: string | null;
        carrierName: string | null;
        courierName: string | null;
        courierPhone: string | null;
        thirdPartyNo: string | null;
        etaMinutes: number | null;
    }>>;
}
