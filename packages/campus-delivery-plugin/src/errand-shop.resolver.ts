import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, ID, RequestContext } from '@vendure/core';
import { ErrandService } from './errand.service';

@Resolver()
export class ErrandShopResolver {
    constructor(private errand: ErrandService) {}

    /** 跑腿单第二步：需先 addItemToOrder(0元载体) 建购物车，再调本 mutation 写标记 + 小费。
     * 未登录/空购物车/小费非法由 service 抛 ForbiddenError/UserInputError。 */
    @Mutation()
    async campusSetErrandInfo(@Ctx() ctx: RequestContext, @Args('input') input: any) {
        const order = await this.errand.setErrandInfo(ctx, input);
        return { orderId: (order as any).id as ID };
    }
}
