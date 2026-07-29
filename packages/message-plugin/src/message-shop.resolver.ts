import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { MessageService } from './message.service';

@Resolver()
export class MessageShopResolver {
    constructor(private messageService: MessageService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myMessages(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any) {
        return this.messageService.findMyMessages(ctx, options);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myUnreadMessageCount(@Ctx() ctx: RequestContext) {
        return this.messageService.getMyUnreadCount(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async markMessageRead(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.messageService.markRead(ctx, id);
    }
}
