import { Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { R2MarkService } from './r2-mark.service';

@Resolver()
export class R2ShopResolver {
    constructor(private r2: R2MarkService) {}

    /** R2 原单卡「接力单状态」子卡数据源（动态反查，无写回） */
    @Query()
    async campusR2Relay(@Ctx() ctx: RequestContext, @Args('orderId') orderId: ID) {
        return this.r2.relayStatus(ctx, orderId);
    }
}
