import { ID, ListQueryBuilder, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { Message } from './entities/message.entity';
import { MessagePushService } from './message-push.service';
export declare class MessageService {
    private connection;
    private listQueryBuilder;
    private pushService;
    private messageRepo;
    private deliveryRepo;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder, pushService: MessagePushService);
    findAll(ctx: RequestContext, options?: any): Promise<PaginatedList<Message>>;
    findOne(ctx: RequestContext, id: ID): Promise<Message | null>;
    create(ctx: RequestContext, input: any): Promise<Message>;
    update(ctx: RequestContext, id: ID, input: any): Promise<Message>;
    delete(ctx: RequestContext, id: ID): Promise<boolean>;
    sendMessage(ctx: RequestContext, id: ID): Promise<Message>;
    /**
     * 由 JobQueue worker 调用，实际执行发送。
     */
    processSending(ctx: RequestContext, messageId: ID): Promise<void>;
    getDeliveryStats(ctx: RequestContext, messageId: ID): Promise<any>;
    private getTargetCustomerIds;
    findMyMessages(ctx: RequestContext, options?: any): Promise<PaginatedList<any>>;
    getMyUnreadCount(ctx: RequestContext): Promise<number>;
    markRead(ctx: RequestContext, deliveryId: ID): Promise<boolean>;
}
