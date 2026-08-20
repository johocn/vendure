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
    /** 按订单+包号查询单个包裹（供 batchCreateFulfillment 按包行过滤复用） */
    findByOrderAndCode(ctx: RequestContext, orderId: ID, code: string): Promise<OrderPackage | null>;
    /** 状态流转：幂等（同状态返回 true）、非法流转告警忽略、未命中告警返回 false；不抛错不阻断主链路 */
    transition(ctx: RequestContext, orderId: ID, packageId: string, toStatus: OrderPackageStatus): Promise<boolean>;
    /**
     * 履约闭环核心：按包裹生命周期聚合推导订单目标状态并推进。
     * 幂等（订单已到目标状态跳过）、非法流转经 getNextOrderStates 二次过滤仅告警。
     */
    reconcileOrderState(ctx: RequestContext, orderId: ID): Promise<void>;
    /** 订单首次进入 Delivered 时写 fulfillmentDeliveredAt（自动交易完成的扫描基准；已写过则跳过） */
    markDeliveredAt(ctx: RequestContext, orderId: ID): Promise<void>;
    /** self 包 fulfillment 镜像：包裹 shipped/delivered 时同步 fulfillment 状态（core 一致性，失败仅告警） */
    mirrorFulfillment(ctx: RequestContext, pkg: OrderPackage, toStatus: 'shipped' | 'delivered'): Promise<void>;
    /**
     * C端确认收货：归属校验（customer.user.id === activeUserId）+ Delivered → Completed（幂等）。
     * 复用阶段7 的归属校验模式：ctx.activeUserId 是登录 User 主键，而 Order.customer.id 是 Customer 主键，两者不同。
     */
    confirmOrderReceipt(ctx: RequestContext, orderId: ID): Promise<boolean>;
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
