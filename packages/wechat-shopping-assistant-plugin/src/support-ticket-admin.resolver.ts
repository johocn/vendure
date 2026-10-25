import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, UserInputError } from '@vendure/core';

import { WechatSupportTicket } from './entities/wechat-support-ticket.entity';
import { SupportTicketService } from './support-ticket.service';

/** 留言工单后台接口：列表 + 回复（回复经公众号客服消息下发到用户） */
@Resolver()
export class SupportTicketAdminResolver {
    constructor(private supportTickets: SupportTicketService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async wechatSupportTickets(
        @Ctx() ctx: RequestContext,
        @Args('limit') limit?: number,
        @Args('status') status?: string,
    ): Promise<WechatSupportTicket[]> {
        return this.supportTickets.list(ctx, { limit, status });
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async replyWechatSupportTicket(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
        @Args('content') content: string,
    ): Promise<WechatSupportTicket> {
        if (!content?.trim()) throw new UserInputError('回复内容不能为空');
        return this.supportTickets.reply(ctx, id, content);
    }
}
