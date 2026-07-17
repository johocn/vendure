import { Fulfillment, ID, ListQueryBuilder, ListQueryOptions, Order, PaginatedList, Refund, RequestContext, TransactionalConnection } from '@vendure/core';
import { SubscribeMessageLog } from './subscribe-message-log.entity';
import { WechatMessageProvider } from './wechat-message-provider';
import { WechatSubscribeMessagePluginOptions } from './types';
export interface SubscribeMessageLogListOptions extends ListQueryOptions<SubscribeMessageLog> {
    customerId?: ID;
    status?: string;
}
export declare class SubscribeMessageService {
    private connection;
    private listQueryBuilder;
    private provider;
    private options;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, provider: WechatMessageProvider, options: WechatSubscribeMessagePluginOptions);
    sendOrderPaidMessage(ctx: RequestContext, order: Order): Promise<void>;
    sendOrderShippedMessage(ctx: RequestContext, order: Order, fulfillment?: Fulfillment): Promise<void>;
    sendOrderDeliveredMessage(ctx: RequestContext, order: Order): Promise<void>;
    sendOrderRefundedMessage(ctx: RequestContext, order: Order, refund: Refund): Promise<void>;
    sendCustomMessage(ctx: RequestContext, customerId: ID, templateId: string, data: Record<string, {
        value: string;
        color?: string;
    }>, page?: string): Promise<SubscribeMessageLog>;
    getSendLogs(ctx: RequestContext, options?: SubscribeMessageLogListOptions): Promise<PaginatedList<SubscribeMessageLog>>;
    private dispatchForOrder;
    private sendAndLog;
    private getLatestFulfillment;
    private getOpenidByCustomer;
    private readCustomerOpenid;
    private getChannelTemplateId;
    private resolvePage;
    private resolveMiniprogramState;
    private formatMoney;
    private formatDate;
}
