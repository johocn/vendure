import { CustomerService, ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { InboxMessage } from './inbox-message.entity';
import { NotifierProvider } from './notifier/notifier-provider';
import { InboxMessageListOptions, NotificationFrame, NotificationPluginOptions } from './types';
/**
 * 消息触达编排与站内信存储。
 * deliver(frame)：站内信真实落库（inboxEnabled 开关），再经 notifier 外发（微信，失败不阻断）。
 */
export declare class NotificationService {
    private options;
    private connection;
    private orderService;
    private customerService;
    private notifier;
    constructor(options: NotificationPluginOptions, connection: TransactionalConnection, orderService: OrderService, customerService: CustomerService);
    /** 由插件 onApplicationBootstrap 注入 notifier（避免 DI 环）。 */
    init(notifier: NotifierProvider): void;
    /** 写一条站内信，返回落库实体。 */
    createInbox(ctx: RequestContext, frame: NotificationFrame, opts: {
        recipientType: 'customer' | 'admin';
        customerId?: number;
        administratorId?: number;
    }): Promise<InboxMessage>;
    /** C 端收件箱：当前顾客的站内信（按 id 倒序）。 */
    listCustomerInbox(ctx: RequestContext, options?: InboxMessageListOptions): Promise<{
        items: InboxMessage[];
        totalItems: number;
    }>;
    /** 店主/平台收件箱：当前登录管理员。 */
    listAdminInbox(ctx: RequestContext, options?: InboxMessageListOptions): Promise<{
        items: InboxMessage[];
        totalItems: number;
    }>;
    /** 未读数。 */
    unreadCount(ctx: RequestContext, t?: 'customer' | 'admin'): Promise<number>;
    /** 置已读（仅本人）。 */
    markRead(ctx: RequestContext, id: ID, t: 'customer' | 'admin'): Promise<InboxMessage>;
    /** 订单状态迁移 → 买家/店主站内信 + 微信。 */
    onOrderStateTransition(ctx: RequestContext, orderId: ID, toState: string): Promise<void>;
    /** 退款 Settled → 买家到账通知。 */
    onRefundSettled(ctx: RequestContext, orderId: ID, refundTotalWithTax: number): Promise<void>;
    private deliver;
    /** 涉及店铺的店主收件箱推送（沿 Product.shopId → Shop.administratorId）。 */
    private notifyShopOwners;
    /** 订单行 → productVariant.productId → Product.shopId 反查去重（对齐 address-plugin getOrderShopIds）。 */
    private getOrderShopIds;
    private titleFor;
    private descFor;
    private requireCustomer;
    /** 按登录 User 主键反查 Administrator（Administrator.user 关系）。 */
    private administratorForUser;
}
