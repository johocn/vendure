import { ID, RequestContext } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { CampusConfigService } from './campus-config.service';
import { RiderService } from './rider.service';
export declare class RiderShopResolver {
    private riderService;
    private configService;
    private capacity;
    constructor(riderService: RiderService, configService: CampusConfigService, capacity: CapacityService);
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
    /** 骑手上下线开关（大厅轮询页 15s 轮询续命） */
    campusRiderOnline(ctx: RequestContext, online: boolean): Promise<{
        online: boolean;
    }>;
    /** 骑手心跳（30s 定时调），带骑手资格校验 */
    campusRiderHeartbeat(ctx: RequestContext): Promise<{
        online: boolean;
    }>;
    /** T0 运力预检：C 端下单前提示「运力紧张」 */
    campusCapacityCheck(ctx: RequestContext): Promise<{
        paused: boolean;
        ridersOnline: number;
    }>;
    campusZones(ctx: RequestContext): Promise<import("./campus-zone.entity").CampusZone[]>;
    campusBuildings(ctx: RequestContext, zoneId?: ID): Promise<import("./campus-building.entity").CampusBuilding[]>;
}
