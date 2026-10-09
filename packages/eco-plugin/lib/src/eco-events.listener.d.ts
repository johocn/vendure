import { CustomerService, EventBus, OrderService } from '@vendure/core';
import { EcoReporter } from './eco-reporter.service';
/**
 * 生态行为监听器：
 * - purchase：订单支付成功后（OrderPlacedEvent，每单恰好一次）上报下单用户
 * - distribute：分销直接佣金落库后（distribution-plugin 发布的 CommissionRecordCreatedEvent）上报 inviter
 * 所有处理均 try/catch 兜底 + fire-and-forget，失败绝不影响订单/佣金主流程。
 */
export declare class EcoEventsListener {
    private eventBus;
    private orderService;
    private customerService;
    private reporter;
    constructor(eventBus: EventBus, orderService: OrderService, customerService: CustomerService, reporter: EcoReporter);
    /** 由 EcoPlugin.onApplicationBootstrap 调用，避免 Nest 生命周期重复触发 */
    init(): void;
    private reportPurchase;
    private reportDistribute;
}
