import { Args, ID as GqlID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';
import { ChatService } from './chat.service';

/** C 端：在线客服 IM（发起会话 / 会话列表 / 增量消息 / 发消息 / 已读 / 结束） */
@Resolver()
export class ChatShopResolver {
    constructor(private chat: ChatService) {}

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusStartChat(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'orderCode', type: () => String, nullable: true }) orderCode?: string,
        @Args({ name: 'subject', type: () => String, nullable: true }) subject?: string,
    ) {
        return this.chat.startConversation(ctx, orderCode, subject);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusMyChatConversations(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.chat.myConversations(ctx, skip, take);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async campusChatMessages(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
        @Args({ name: 'afterId', type: () => GqlID, nullable: true }) afterId?: ID,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.chat.messages(ctx, conversationId, afterId, take);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusSendChatMessage(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
        @Args({ name: 'content', type: () => String, nullable: true }) content?: string,
        @Args({ name: 'images', type: () => [String], nullable: true }) images?: string[],
    ) {
        return this.chat.sendMessage(ctx, conversationId, content, images);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusMarkChatRead(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
    ) {
        return this.chat.markRead(ctx, conversationId);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async campusCloseChat(
        @Ctx() ctx: RequestContext,
        @Args('conversationId', { type: () => GqlID }) conversationId: ID,
    ) {
        return this.chat.closeConversation(ctx, conversationId);
    }
}
