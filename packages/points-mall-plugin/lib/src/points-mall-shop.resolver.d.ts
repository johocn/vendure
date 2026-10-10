import { ID, RequestContext } from '@vendure/core';
import { PointsMallService } from './points-mall.service';
import { CreatePointsOrderInput, FavoriteProductView, PointsOrderListOptions, PointsPayParams, PointsProductListOptions, PointsProductView, ToggleFavoriteResult } from './types';
export declare class PointsMallShopResolver {
    private pointsMallService;
    constructor(pointsMallService: PointsMallService);
    /** 游客可浏览积分商城列表（对齐 usemall），不加 @Allow。 */
    pointsProducts(ctx: RequestContext, options?: PointsProductListOptions): Promise<{
        items: PointsProductView[];
        totalItems: number;
    }>;
    /** 游客可看详情，不加 @Allow。 */
    pointsProduct(ctx: RequestContext, id: ID): Promise<PointsProductView | undefined>;
    myFavorites(ctx: RequestContext, options?: PointsProductListOptions): Promise<{
        items: FavoriteProductView[];
        totalItems: number;
    }>;
    /** 游客可看收藏元信息（service 内部处理未登录），不加 @Allow。 */
    productFavoriteMeta(ctx: RequestContext, productId: ID): Promise<{
        favoriteCount: number;
        myFavorited: boolean;
    }>;
    myPointsOrders(ctx: RequestContext, options?: PointsOrderListOptions): Promise<import("@vendure/core").PaginatedList<import("./points-order.entity").PointsOrder>>;
    myPointsOrder(ctx: RequestContext, id: ID): Promise<import("./points-order.entity").PointsOrder | undefined>;
    toggleProductFavorite(ctx: RequestContext, productId: ID): Promise<ToggleFavoriteResult>;
    createPointsOrderExchange(ctx: RequestContext, input: CreatePointsOrderInput): Promise<import("./points-order.entity").PointsOrder>;
    /** 拉取外部微信支付接口，不在 DB 事务内。 */
    createPointsOrderPayment(ctx: RequestContext, pointsOrderId: ID, tradeType?: string, openid?: string): Promise<PointsPayParams>;
    cancelPointsOrder(ctx: RequestContext, id: ID): Promise<import("./points-order.entity").PointsOrder>;
}
