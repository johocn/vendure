import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { InboxMessage } from './inbox-message.entity';
import { NotificationService } from './notification.service';

@Resolver()
export class NotificationShopResolver {
    constructor(private notificationService: NotificationService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myInbox(@Ctx() ctx: RequestContext): Promise<{ items: InboxMessage[]; totalItems: number }> {
        return this.notificationService.listCustomerInbox(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async inboxUnreadCount(@Ctx() ctx: RequestContext): Promise<number> {
        return this.notificationService.unreadCount(ctx, 'customer');
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async markInboxRead(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<InboxMessage> {
        return this.notificationService.markRead(ctx, id, 'customer');
    }
}