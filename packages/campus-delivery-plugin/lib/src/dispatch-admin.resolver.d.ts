import { ID, RequestContext } from '@vendure/core';
import { DispatchAdminService } from './dispatch-admin.service';
export declare class DispatchAdminResolver {
    private dispatchAdmin;
    constructor(dispatchAdmin: DispatchAdminService);
    campusDispatchBoard(ctx: RequestContext): Promise<{
        paused: boolean;
        alerts: import("./dispatch-admin.service").DispatchAlert[];
        hallOrders: import("@vendure/core").Order[];
        activeOrders: import("@vendure/core").Order[];
        ridersOnline: import("./dispatch-admin.service").DispatchRider[];
    }>;
    campusAssignOrder(ctx: RequestContext, orderId: ID, riderCustomerId: ID): Promise<{
        assigned: boolean;
    }>;
    campusBackToHall(ctx: RequestContext, orderId: ID): Promise<{
        backToHall: boolean;
    }>;
}
