import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { MessageService } from './message.service';

// 注意：C 端 shop 查询不带 @Allow（默认 Public）。
// 多租户体系下客户角色（__customer_role__）仅关联默认渠道，非默认渠道上
// Permission.Authenticated 判定恒失败（userHasPermissions 无渠道权限记录），
// 故统一改为 Public + service 层 activeUserId/归属校验（与 coupon-plugin myCoupons 一致）。
@Resolver()
export class MessageShopResolver {
    constructor(private messageService: MessageService) {}

    @Query()
    async myMessages(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any) {
        return this.messageService.findMyMessages(ctx, options);
    }

    @Query()
    async myUnreadMessageCount(@Ctx() ctx: RequestContext) {
        return this.messageService.getMyUnreadCount(ctx);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async markMessageRead(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.messageService.markRead(ctx, id);
    }
}
