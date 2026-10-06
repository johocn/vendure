import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { ErrandService } from './errand.service';

@Resolver()
export class ErrandShopResolver {
    constructor(private errand: ErrandService) {}

    /** R5 发单第一步数据源：0 元载体 variantId（幂等建）+ 本渠道跑腿起步价（分，null→200） */
    @Query()
    async campusErrandVariant(@Ctx() ctx: RequestContext) {
        const { variantId, sku } = await this.errand.ensureErrandProduct(ctx);
        return { variantId, sku, errandBaseFee: await this.errand.getErrandBaseFee(ctx) };
    }

    /** 跑腿单第二步：需先 addItemToOrder(0元载体) 建购物车，再调本 mutation 写标记 + 小费。
     * 未登录/空购物车/小费非法由 service 抛 ForbiddenError/UserInputError。 */
    @Mutation()
    async campusSetErrandInfo(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const order = await this.errand.setErrandInfo(ctx, input);
        return { orderId: (order as any).id as ID };
    }
}
