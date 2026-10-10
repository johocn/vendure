import { ID, PaginatedList, RequestContext } from '@vendure/core';
import { PointsMallService } from './points-mall.service';
import { PointsOrder } from './points-order.entity';
import { PointsProduct } from './points-product.entity';
import { PointsOrderListOptions, PointsProductListOptions } from './types';
export declare class PointsMallAdminResolver {
    private pointsMallService;
    constructor(pointsMallService: PointsMallService);
    pointsProductsAdmin(ctx: RequestContext, options?: PointsProductListOptions): Promise<PaginatedList<PointsProduct>>;
    pointsOrdersAdmin(ctx: RequestContext, options?: PointsOrderListOptions): Promise<PaginatedList<PointsOrder>>;
    createPointsProduct(ctx: RequestContext, input: any): Promise<PointsProduct>;
    updatePointsProduct(ctx: RequestContext, input: any): Promise<PointsProduct>;
    deletePointsProduct(ctx: RequestContext, id: ID): Promise<boolean>;
    markPointsOrderPaid(ctx: RequestContext, id: ID): Promise<PointsOrder>;
    markPointsOrderShipped(ctx: RequestContext, id: ID, trackingNo?: string): Promise<PointsOrder>;
    markPointsOrderCompleted(ctx: RequestContext, id: ID): Promise<PointsOrder>;
}
