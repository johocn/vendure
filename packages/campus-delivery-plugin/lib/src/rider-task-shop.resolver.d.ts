import { ID, RequestContext } from '@vendure/core';
import { R2MarkService } from './r2-mark.service';
import { RiderTaskService } from './rider-task.service';
export declare class RiderTaskShopResolver {
    private riderTaskService;
    private r2Mark;
    constructor(riderTaskService: RiderTaskService, r2Mark: R2MarkService);
    /** 需登录骑手：service 内部 assertApprovedRider，未登录/未批准/信用分不足抛 ForbiddenError。 */
    campusMyTasks(ctx: RequestContext, status?: string): Promise<import("@vendure/core").Order[]>;
    campusStartTask(ctx: RequestContext, orderId: ID): Promise<import("@vendure/core").Order>;
    campusDeliverTask(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<import("@vendure/core").Order>;
    campusReportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string): Promise<import("@vendure/core").Order>;
    /** R2 快递单到校确认：本人 + fulfillmentRoute='R2'，service 内校验，违规抛 Forbidden/UserInputError。 */
    campusMarkArrived(ctx: RequestContext, orderId: ID): Promise<{
        leg1Status: string;
    }>;
}
