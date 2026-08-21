import { RequestContext } from '@vendure/core';
import { InboxMessage } from './inbox-message.entity';
import { NotificationService } from './notification.service';
export declare class NotificationAdminResolver {
    private notificationService;
    constructor(notificationService: NotificationService);
    adminInbox(ctx: RequestContext): Promise<{
        items: InboxMessage[];
        totalItems: number;
    }>;
    adminInboxUnreadCount(ctx: RequestContext): Promise<number>;
    markAdminInboxRead(ctx: RequestContext, id: string): Promise<InboxMessage>;
}
