import { ID, RequestContext } from '@vendure/core';
import { ErrandService } from './errand.service';
export declare class ErrandShopResolver {
    private errand;
    constructor(errand: ErrandService);
    /** 跑腿单第二步：需先 addItemToOrder(0元载体) 建购物车，再调本 mutation 写标记 + 小费。
     * 未登录/空购物车/小费非法由 service 抛 ForbiddenError/UserInputError。 */
    campusSetErrandInfo(ctx: RequestContext, input: any): Promise<{
        orderId: ID;
    }>;
}
