import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { SubscribeMessageService, SubscribeMessageLogListOptions } from './subscribe-message.service';

@Resolver()
export class SubscribeMessageAdminResolver {
    constructor(private subscribeMessageService: SubscribeMessageService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async subscribeMessageLogs(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options: SubscribeMessageLogListOptions | undefined,
    ): Promise<any> {
        return this.subscribeMessageService.getSendLogs(ctx, options);
    }
}
