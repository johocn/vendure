import { ID, RequestContext } from '@vendure/core';
import { HallGrabService } from './hall-grab.service';
export declare class HallShopResolver {
    private grab;
    constructor(grab: HallGrabService);
    /** grab 失败（已被抢/抢自己的/非骑手）由 service 抛 UserInputError/ForbiddenError，Vendure 转 GraphQL 错误。 */
    campusGrabOrder(ctx: RequestContext, orderId: ID): Promise<import("@vendure/core").Order>;
    campusHall(ctx: RequestContext): Promise<import("@vendure/core").Order[]>;
}
