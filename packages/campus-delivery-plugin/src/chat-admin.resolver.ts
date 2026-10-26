import { Args, ID as GqlID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { CampusPermissions } from './permissions';
import { ChatService } from './chat.service';

/** 后台：在线客服 IM（会话列表 / 消息 / 回复 / 关闭 / 未读角标） */
@Resolver()
export class ChatAdminResolver {
    constructor(private chat: ChatService) {}

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusChatConversations(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'unreadOnly', type: () => Boolean, nullable: true }) unreadOnly?: boolean,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.chat.adminConversations(ctx, status, unreadOnly, skip, take);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusChatUnread(@Ctx() ctx: RequestContext) {
        return this.chat.adminUnread(ctx);
    }

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusAdminChatMessages(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
        @Args({ name: 'afterId', type: () => GqlID, nullable: true }) afterId?: ID,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.chat.adminMessages(ctx, conversationId, afterId, take);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusReplyChat(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
        @Args({ name: 'content', type: () => String, nullable: true }) content?: string,
        @Args({ name: 'images', type: () => [String], nullable: true }) images?: string[],
    ) {
        return this.chat.adminReply(ctx, conversationId, content, images);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusCloseChatConversation(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
    ) {
        return this.chat.adminClose(ctx, conversationId);
    }
}
