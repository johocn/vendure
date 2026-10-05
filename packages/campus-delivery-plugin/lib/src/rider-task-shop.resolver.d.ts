import { ID, RequestContext } from '@vendure/core';
import { RiderTaskService } from './rider-task.service';
export declare class RiderTaskShopResolver {
    private riderTaskService;
    constructor(riderTaskService: RiderTaskService);
    /** 需登录骑手：service 内部 assertApprovedRider，未登录/未批准/信用分不足抛 ForbiddenError。 */
    campusMyTasks(ctx: RequestContext, status?: string): Promise<import("@vendure/core").Order[]>;
    campusStartTask(ctx: RequestContext, orderId: ID): Promise<import("@vendure/core").Order>;
    campusDeliverTask(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<import("@vendure/core").Order>;
    campusReportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string): Promise<import("@vendure/core").Order>;
}
