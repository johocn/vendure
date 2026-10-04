import { ID, RequestContext } from '@vendure/core';
import { RiderService } from './rider.service';
export declare class RiderAdminResolver {
    private riderService;
    constructor(riderService: RiderService);
    riderApplications(ctx: RequestContext, status: string): Promise<import("@vendure/core").Customer[]>;
    campusSetRiderStatus(ctx: RequestContext, customerId: ID, status: 'approved' | 'suspended' | 'none'): Promise<{
        status: "approved" | "suspended" | "none";
    }>;
}
