import { Injector, ID, RequestContext } from '@vendure/core';
import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryCancelResult, DeliveryProvider, DeliveryStatusEvent, DeliveryStatusSink } from './delivery-provider';
export declare class DeliveryGatewayService {
    private injector;
    private connection;
    private providers;
    /** 可选：logistics-plugin 注册的 OrderPackageLinker（OrderPackageService），用于按包回填配送单 + 状态回写 */
    private orderPackageLinker;
    /** 可选：业务侧（campus-delivery-plugin）注册的状态接收器，避免反向编译依赖 */
    private statusSink;
    init(injector: Injector): void;
    registerStatusSink(sink: DeliveryStatusSink): void;
    registerProvider(provider: DeliveryProvider): void;
    getProvider(code: string): DeliveryProvider | undefined;
    createDelivery(ctx: RequestContext, input: {
        orderId: ID;
        packageId: string;
        providerCode: string;
        pickup: any;
        dropoff: any;
        items: any[];
        remark?: string;
        providerShopNo?: string;
    }): Promise<DeliveryOrder>;
    /** 按订单查询配送单列表（新建在前） */
    findByOrder(ctx: RequestContext, orderId: ID): Promise<DeliveryOrder[]>;
    /** 取订单最新配送单（派单/展示用） */
    findLatestByOrder(ctx: RequestContext, orderId: ID): Promise<DeliveryOrder | null>;
    /** 取消外部快递配送（非终态才真正调用；终态直接返回幂等成功） */
    cancelDelivery(ctx: RequestContext, deliveryOrderId: ID, reason?: string): Promise<DeliveryCancelResult>;
    /** 处理平台回写（webhook 或 Mock 模拟），驱动状态机 */
    applyStatusEvent(ctx: RequestContext, event: DeliveryStatusEvent): Promise<DeliveryOrder>;
    /** 供 C端 Shop API 查询：返回配送单骑手信息（仅公开字段） */
    getShopDelivery(ctx: RequestContext, deliveryOrderId: ID): Promise<{
        courierName: string | null;
        courierPhone: string | null;
        thirdPartyNo: string | null;
        etaMinutes: number | null;
    } | null>;
}
