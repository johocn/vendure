import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { InboxMessage } from './inbox-message.entity';
import { NotificationService } from './notification.service';

@Resolver()
export class NotificationAdminResolver {
    constructor(private notificationService: NotificationService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async adminInbox(@Ctx() ctx: RequestContext): Promise<{ items: InboxMessage[]; totalItems: number }> {
        return this.notificationService.listAdminInbox(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async adminInboxUnreadCount(@Ctx() ctx: RequestContext): Promise<number> {
        return this.notificationService.unreadCount(ctx, 'admin');
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async markAdminInboxRead(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<InboxMessage> {
        return this.notificationService.markRead(ctx, id, 'admin');
    }
}