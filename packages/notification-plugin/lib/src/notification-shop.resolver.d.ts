import { RequestContext } from '@vendure/core';
import { InboxMessage } from './inbox-message.entity';
import { NotificationService } from './notification.service';
export declare class NotificationShopResolver {
    private notificationService;
    constructor(notificationService: NotificationService);
    myInbox(ctx: RequestContext): Promise<{
        items: InboxMessage[];
        totalItems: number;
    }>;
    inboxUnreadCount(ctx: RequestContext): Promise<number>;
    markInboxRead(ctx: RequestContext, id: string): Promise<InboxMessage>;
}
