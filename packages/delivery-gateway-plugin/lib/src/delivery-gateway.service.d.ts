import { Injector, ID, RequestContext } from '@vendure/core';
import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryProvider, DeliveryStatusEvent } from './delivery-provider';
export declare class DeliveryGatewayService {
    private injector;
    private connection;
    private providers;
    /** 可选：logistics-plugin 注册的 OrderPackageLinker（OrderPackageService），用于按包回填配送单 */
    private orderPackageLinker;
    init(injector: Injector): void;
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
    }): Promise<DeliveryOrder>;
    /** 按订单查询配送单列表（新建在前） */
    findByOrder(ctx: RequestContext, orderId: ID): Promise<DeliveryOrder[]>;
    /** 处理平台回写（webhook 或 Mock 模拟），驱动状态机 */
    applyStatusEvent(ctx: RequestContext, event: DeliveryStatusEvent): Promise<DeliveryOrder>;
}
