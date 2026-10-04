import { ID, RequestContext } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { RiderService } from './rider.service';
export declare class RiderShopResolver {
    private riderService;
    private configService;
    constructor(riderService: RiderService, configService: CampusConfigService);
    /** 需登录：service 内部校验当前顾客，未登录抛 ForbiddenError。 */
    applyRider(ctx: RequestContext, realName: string, studentNo: string, campus: string, idImg?: string): Promise<{
        status: string;
    }>;
    myRiderProfile(ctx: RequestContext): Promise<{
        customerId: ID;
        riderStatus: any;
        riderRealName: any;
        riderStudentNo: any;
        riderCampus: any;
        riderCredit: any;
    }>;
    campusZones(ctx: RequestContext): Promise<import("./campus-zone.entity").CampusZone[]>;
    campusBuildings(ctx: RequestContext, zoneId?: ID): Promise<import("./campus-building.entity").CampusBuilding[]>;
}
